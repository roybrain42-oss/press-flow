import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { generateToken, authenticate } from '../auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    // Look up via getUserByEmailAsync so we check memory AND Firestore
    const user = await db.getUserByEmailAsync(cleanEmail);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password. Please verify your credentials or register your printing press.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: 'Your account is suspended. Please contact platform support.' });
      return;
    }

    if (!user.password_hash) {
      console.warn(`[Auth] User ${cleanEmail} lacks password_hash in store.`);
      res.status(401).json({ error: 'Account credentials need updating. Please use Forgot Password or reset your password.' });
      return;
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = bcrypt.compareSync(String(password), user.password_hash);
    } catch (bcryptErr) {
      console.error('[Auth] Bcrypt compare error:', bcryptErr);
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password. Please check your credentials.' });
      return;
    }

    // If user is owner or staff, check tenant status
    let tenant = null;
    if (user.tenant_id) {
      tenant = await db.getTenantByIdAsync(user.tenant_id);
      if (!tenant) {
        // Fallback: check if tenant exists by owner email
        tenant = db.getTenants().find((t) => t.email?.toLowerCase() === cleanEmail) || null;
      }

      // Auto-recovery: If owner tenant was deleted or missing, rebuild an active tenant record so owner is NEVER locked out!
      if (!tenant && user.role === 'owner') {
        console.warn(`[Auth] Auto-recovering missing tenant for owner ${cleanEmail}`);
        tenant = db.createTenant({
          name: user.name ? `${user.name}'s Printing Press` : 'PrintFlow Press',
          slug: `press-${Date.now().toString(36)}`,
          owner_name: user.name || 'Press Owner',
          email: user.email,
          phone: user.phone || '',
          location: 'Ghana',
          address: '',
          description: 'Commercial digital print & copy center',
          logo_url: 'https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=150&auto=format&fit=crop&q=80',
          status: 'active',
          plan_id: 'free',
          settings: {
            currency: 'GHS',
            currency_symbol: 'GH₵',
            operating_hours: 'Mon–Sat: 8:00 AM – 7:00 PM',
            pay_at_shop_enabled: true,
            online_payment_enabled: false,
            payment_provider: 'paystack',
            document_retention_days: 14,
            max_file_size_mb: 25,
            allow_notes: true,
          },
        });
        db.updateUser(user.id, { tenant_id: tenant.id });
        user.tenant_id = tenant.id;
      }

      if (tenant && tenant.status === 'suspended') {
        res.status(403).json({ error: 'This printing press has been suspended by the platform administrator.' });
        return;
      }
    }

    const token = generateToken({
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    // Log successful login
    db.addAuditLog({
      tenant_id: user.tenant_id,
      user_id: user.id,
      user_email: user.email,
      role: user.role,
      action: 'USER_LOGIN_SUCCESS',
      resource_type: 'user',
      resource_id: user.id,
      ip: req.ip,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        tenant_id: user.tenant_id,
      },
      tenant,
    });
  } catch (err: any) {
    console.error('[Auth Error] Error during login:', err);
    res.status(500).json({ error: err?.message || 'Login failed due to a server error. Please try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, new_password } = req.body || {};
    if (!email || !new_password) {
      res.status(400).json({ error: 'Email and new password are required.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const user = await db.getUserByEmailAsync(cleanEmail);
    if (!user) {
      res.status(404).json({ error: 'No user account found with this email address.' });
      return;
    }

    if (String(new_password).length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const passwordHash = bcrypt.hashSync(String(new_password), 10);
    db.updateUser(user.id, { password_hash: passwordHash });

    db.addAuditLog({
      tenant_id: user.tenant_id,
      user_id: user.id,
      user_email: user.email,
      role: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      resource_type: 'user',
      resource_id: user.id,
      ip: req.ip,
    });

    res.json({ message: 'Password updated successfully. You can now log in with your credentials.' });
  } catch (err: any) {
    console.error('[Auth Error] Error resetting password:', err);
    res.status(500).json({ error: err?.message || 'Failed to update password.' });
  }
});

// POST /api/auth/register-press
// Onboarding flow for new printing press
router.post('/register-press', async (req: Request, res: Response) => {
  try {
    const {
      business_name,
      owner_name,
      email,
      password,
      phone,
      location,
      address,
      description,
      operating_hours,
    } = req.body || {};

    if (!business_name || !owner_name || !email || !password || !phone) {
      res.status(400).json({ error: 'Business name, owner name, email, password, and phone number are required.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      res.status(400).json({ error: 'Please enter a valid business email address.' });
      return;
    }

    // Check if email already exists (async checks memory and Firestore)
    const existingUser = await db.getUserByEmailAsync(cleanEmail);
    if (existingUser) {
      res.status(409).json({ error: 'A user account with this email already exists. Please log in or use another email.' });
      return;
    }

    // Generate unique slug from business name
    let baseSlug = String(business_name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!baseSlug) baseSlug = 'print-shop';

    let slug = baseSlug;
    let counter = 1;
    while (db.getTenantBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create Tenant (Status: active for immediate access)
    const tenant = db.createTenant({
      slug,
      name: String(business_name).trim(),
      owner_name: String(owner_name).trim(),
      email: cleanEmail,
      phone: String(phone).trim(),
      location: location ? String(location).trim() : 'Ghana',
      address: address ? String(address).trim() : '',
      description: description ? String(description).trim() : 'Digital and offset printing services',
      logo_url: 'https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      plan_id: 'free',
      settings: {
        currency: 'GHS',
        currency_symbol: 'GH₵',
        operating_hours: operating_hours ? String(operating_hours).trim() : 'Monday – Saturday: 8:00 AM – 7:00 PM',
        pay_at_shop_enabled: true,
        online_payment_enabled: false,
        payment_provider: 'paystack',
        document_retention_days: 14,
        max_file_size_mb: 25,
        allow_notes: true,
      },
    });

    // Create Owner User Account
    const passwordHash = bcrypt.hashSync(String(password), 10);
    const user = db.createUser({
      tenant_id: tenant.id,
      role: 'owner',
      name: String(owner_name).trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      phone: String(phone).trim(),
      status: 'active',
    });

    // Add default baseline services for the new press
    db.createService({
      tenant_id: tenant.id,
      name: 'A4 Black & White Printing',
      category: 'printing',
      unit_type: 'per_page',
      price: 0.50,
      description: 'Standard monochrome 80gsm printing',
      is_active: true,
    });

    db.createService({
      tenant_id: tenant.id,
      name: 'A4 Colour Printing',
      category: 'printing',
      unit_type: 'per_page',
      price: 2.00,
      description: 'Full color digital laser print',
      is_active: true,
    });

    db.createService({
      tenant_id: tenant.id,
      name: 'Plastic Comb Binding',
      category: 'finishing',
      unit_type: 'per_document',
      price: 8.00,
      description: 'Comb binding with clear cover',
      is_active: true,
    });

    // Log registration
    db.addAuditLog({
      tenant_id: tenant.id,
      user_id: user.id,
      user_email: user.email,
      role: 'owner',
      action: 'PRINTING_PRESS_REGISTERED',
      resource_type: 'tenant',
      resource_id: tenant.id,
      details: { business_name, slug, location },
      ip: req.ip,
    });

    const token = generateToken({
      id: user.id,
      tenant_id: tenant.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    res.status(201).json({
      message: 'Printing press registered successfully! Your private dashboard is ready.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        tenant_id: user.tenant_id,
      },
      tenant,
      dashboard_url: `/?portal=${tenant.slug}`,
    });
  } catch (err: any) {
    console.error('[Auth Error] Error during printing press registration:', err);
    res.status(500).json({
      error: err?.message || 'An unexpected error occurred during company registration. Please try again.',
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = db.getUserById(req.user.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  let tenant = null;
  if (user.tenant_id) {
    tenant = db.getTenantById(user.tenant_id);
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      tenant_id: user.tenant_id,
    },
    tenant,
  });
});

// PUT /api/auth/profile (Update display name, email, and password)
router.put('/profile', authenticate, (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = db.getUserById(req.user.id);
  if (!user) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }

  const { name, email, phone, current_password, new_password } = req.body;

  // Validation
  if (name !== undefined && typeof name === 'string' && name.trim().length === 0) {
    res.status(400).json({ error: 'Name cannot be empty.' });
    return;
  }

  // If email is changing, check uniqueness
  if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
    const existing = db.getUserByEmail(email.trim().toLowerCase());
    if (existing && existing.id !== user.id) {
      res.status(409).json({ error: 'Another user account already uses this email address.' });
      return;
    }
  }

  // Password update handling
  let newPasswordHash: string | undefined = undefined;
  if (new_password) {
    if (typeof new_password !== 'string' || new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    // Verify current password if provided
    if (current_password) {
      const isMatch = bcrypt.compareSync(current_password, user.password_hash);
      if (!isMatch) {
        res.status(400).json({ error: 'Current password does not match.' });
        return;
      }
    }

    newPasswordHash = bcrypt.hashSync(new_password, 10);
  }

  const updatedName = name !== undefined ? name.trim() : user.name;
  const updatedEmail = email !== undefined ? email.trim().toLowerCase() : user.email;
  const updatedPhone = phone !== undefined ? phone.trim() : user.phone;

  const updatedUser = db.updateUser(user.id, {
    name: updatedName,
    email: updatedEmail,
    ...(phone !== undefined ? { phone: updatedPhone } : {}),
    ...(newPasswordHash ? { password_hash: newPasswordHash } : {}),
  });

  if (!updatedUser) {
    res.status(500).json({ error: 'Failed to update user profile.' });
    return;
  }

  // If user is owner of a printing press tenant, keep tenant contact details in sync
  if (user.tenant_id && user.role === 'owner') {
    const tenant = db.getTenantById(user.tenant_id);
    if (tenant) {
      db.updateTenant(user.tenant_id, {
        ...(name !== undefined ? { owner_name: updatedName } : {}),
        ...(email !== undefined ? { email: updatedEmail } : {}),
        ...(phone !== undefined ? { phone: updatedPhone } : {}),
      });
    }
  }

  // Log audit event
  db.addAuditLog({
    tenant_id: user.tenant_id,
    user_id: user.id,
    user_email: updatedEmail,
    role: user.role,
    action: 'USER_PROFILE_UPDATED',
    resource_type: 'user',
    resource_id: user.id,
    details: {
      changed_name: name !== undefined && name !== user.name,
      changed_email: email !== undefined && email !== user.email,
      changed_password: !!newPasswordHash,
    },
    ip: req.ip,
  });

  // Generate fresh token
  const token = generateToken({
    id: updatedUser.id,
    tenant_id: updatedUser.tenant_id,
    role: updatedUser.role,
    name: updatedUser.name,
    email: updatedUser.email,
  });

  res.json({
    message: 'Profile and credentials updated successfully.',
    token,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      tenant_id: updatedUser.tenant_id,
    },
  });
});

export default router;
