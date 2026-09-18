import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { db, JobStatus } from '../db';
import { authenticate, requireRole, verifyTenant } from '../auth';
import { serveSecureDocument } from '../storage';
import { syncDocToFirestore, deleteDocFromFirestore } from '../firebase';

const router = Router();

// Helper to reliably resolve the verified tenant ID
function getTenantId(req: Request): string {
  if (req.user?.role === 'super_admin') {
    return (req.query.tenant_id as string) || (req.headers['x-tenant-id'] as string) || req.tenantId || req.user.tenant_id || req.params.tenantId || '';
  }
  return req.tenantId || req.user?.tenant_id || req.params.tenantId || '';
}

// Apply auth and tenant verification across all tenant endpoints
router.use(authenticate);
router.use(verifyTenant);

// GET /api/tenant/dashboard
// Overall KPIs: today's revenue, monthly revenue, jobs by status
router.get('/dashboard', (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const jobs = db.getPrintJobs(tenantId);
  const payments = db.getPayments(tenantId);
  const tenant = db.getTenantById(tenantId);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getTime() - 7 * 86400000).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Revenue calculations
  const todayRevenue = payments
    .filter((p) => p.status === 'paid' && new Date(p.created_at).getTime() >= startOfToday)
    .reduce((sum, p) => sum + p.amount, 0);

  const weeklyRevenue = payments
    .filter((p) => p.status === 'paid' && new Date(p.created_at).getTime() >= startOfWeek)
    .reduce((sum, p) => sum + p.amount, 0);

  const monthlyRevenue = payments
    .filter((p) => p.status === 'paid' && new Date(p.created_at).getTime() >= startOfMonth)
    .reduce((sum, p) => sum + p.amount, 0);

  // Status counts
  const counts = {
    total: jobs.length,
    pending: jobs.filter((j) => j.job_status === 'pending').length,
    accepted: jobs.filter((j) => j.job_status === 'accepted').length,
    processing: jobs.filter((j) => j.job_status === 'processing').length,
    ready_for_pickup: jobs.filter((j) => j.job_status === 'ready_for_pickup').length,
    completed: jobs.filter((j) => j.job_status === 'completed').length,
    rejected: jobs.filter((j) => j.job_status === 'rejected').length,
    cancelled: jobs.filter((j) => j.job_status === 'cancelled').length,
  };

  // Recent 8 jobs
  const recentJobs = jobs.slice(0, 8);

  res.json({
    counts,
    revenue: {
      today: todayRevenue,
      weekly: weeklyRevenue,
      monthly: monthlyRevenue,
      currency: tenant?.settings?.currency_symbol || 'GH₵',
    },
    recentJobs,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          settings: tenant.settings,
        }
      : {},
  });
});

// GET /api/tenant/jobs
// List jobs with search, date filter, status filter, payment status filter
router.get('/jobs', (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  let jobs = db.getPrintJobs(tenantId);

  const { search, status, payment_status, date_range } = req.query;

  if (status && status !== 'all') {
    jobs = jobs.filter((j) => j.job_status === status);
  }

  if (payment_status && payment_status !== 'all') {
    jobs = jobs.filter((j) => j.payment_status === payment_status);
  }

  if (search) {
    const q = String(search).toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.job_number.toLowerCase().includes(q) ||
        j.customer_name.toLowerCase().includes(q) ||
        j.customer_phone.toLowerCase().includes(q) ||
        j.document_name.toLowerCase().includes(q)
    );
  }

  if (date_range === 'today') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    jobs = jobs.filter((j) => new Date(j.created_at).getTime() >= startOfToday.getTime());
  }

  res.json(jobs);
});

// GET /api/tenant/jobs/:id
router.get('/jobs/:id', (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const job = db.getPrintJobById(id, tenantId);

  if (!job) {
    res.status(404).json({ error: 'Job not found in this printing press.' });
    return;
  }

  const document = db.getDocumentById(job.document_id, tenantId);

  res.json({
    job,
    document: document
      ? {
          id: document.id,
          original_name: document.original_name,
          file_size: document.file_size,
          mime_type: document.mime_type,
          access_count: document.access_count,
          expires_at: document.expires_at,
        }
      : null,
  });
});

// PATCH /api/tenant/jobs/:id/status
// Update job status (Pending -> Accepted -> Processing -> Ready for Pickup -> Completed / Rejected / Cancelled)
router.patch('/jobs/:id/status', (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const { status, notes, payment_status } = req.body;

  const validStatuses: JobStatus[] = [
    'pending',
    'accepted',
    'processing',
    'ready_for_pickup',
    'completed',
    'rejected',
    'cancelled',
  ];

  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status: ${status}` });
    return;
  }

  const existingJob = db.getPrintJobById(id, tenantId);
  if (!existingJob) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  const updates: any = {};
  if (status) updates.job_status = status;
  if (notes !== undefined) updates.status_notes = notes;
  if (payment_status) updates.payment_status = payment_status;

  const updatedJob = db.updatePrintJob(id, tenantId, updates);

  // Log status change
  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: 'JOB_STATUS_UPDATED',
    resource_type: 'job',
    resource_id: id,
    details: {
      job_number: existingJob.job_number,
      previous_status: existingJob.job_status,
      new_status: status || existingJob.job_status,
      notes,
    },
    ip: req.ip,
  });

  res.json(updatedJob);
});

// GET /api/tenant/documents/:docId/download
router.get('/documents/:docId/download', (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const docId = req.params.docId;
  serveSecureDocument(req, res, docId, tenantId, req.user?.role === 'super_admin');
});

// --- Owner Only Settings & Staff Management ---

// GET /api/tenant/services
router.get('/services', (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const services = db.getServices(tenantId);
  res.json(services);
});

// POST /api/tenant/services (Add new price/service)
router.post('/services', requireRole('owner', 'staff', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const { name, category, unit_type, price, description } = req.body;

  if (!name || price === undefined) {
    res.status(400).json({ error: 'Service name and price are required.' });
    return;
  }

  const service = db.createService({
    tenant_id: tenantId,
    name,
    category: category || 'printing',
    unit_type: unit_type || 'per_page',
    price: parseFloat(price) || 0,
    description,
    is_active: true,
  });

  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: 'SERVICE_CREATED',
    resource_type: 'service',
    resource_id: service.id,
    details: { name, price },
    ip: req.ip,
  });

  res.status(201).json(service);
});

// PUT /api/tenant/services/:id (Edit price/service details)
router.put('/services/:id', requireRole('owner', 'staff', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const updates = { ...req.body };
  if (updates.price !== undefined) {
    updates.price = parseFloat(updates.price);
  }
  const updated = db.updateService(id, tenantId, updates);

  if (!updated) {
    res.status(404).json({ error: 'Service not found.' });
    return;
  }

  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: 'SERVICE_UPDATED',
    resource_type: 'service',
    resource_id: id,
    details: req.body,
    ip: req.ip,
  });

  res.json(updated);
});

// PATCH /api/tenant/services/:id (Quick price update / toggle active)
router.patch('/services/:id', requireRole('owner', 'staff', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const updates = { ...req.body };
  if (updates.price !== undefined) {
    updates.price = parseFloat(updates.price);
  }
  const updated = db.updateService(id, tenantId, updates);

  if (!updated) {
    res.status(404).json({ error: 'Service not found.' });
    return;
  }

  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: 'SERVICE_UPDATED',
    resource_type: 'service',
    resource_id: id,
    details: req.body,
    ip: req.ip,
  });

  res.json(updated);
});

// DELETE /api/tenant/services/:id (Delete price/service)
router.delete('/services/:id', requireRole('owner', 'staff', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const deleted = db.deleteService(id, tenantId);

  if (!deleted) {
    res.status(404).json({ error: 'Service not found.' });
    return;
  }

  res.json({ success: true, message: 'Service deleted.' });
});

// GET /api/tenant/staff (Owner only)
router.get('/staff', requireRole('owner', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const staff = db.getUsers(tenantId).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    status: u.status,
    created_at: u.created_at,
  }));
  res.json(staff);
});

// POST /api/tenant/staff (Owner only: Add staff member)
router.post('/staff', requireRole('owner', 'super_admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Staff name, email, and password are required.' });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();

    if (password.length < 6) {
      res.status(400).json({ error: 'Temporary password must be at least 6 characters.' });
      return;
    }

    // Check memory and Firestore for existing user
    const existingUser = await db.getUserByEmailAsync(cleanEmail);
    if (existingUser) {
      res.status(409).json({ error: 'A user account with this email address already exists.' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const newStaff = db.createUser({
      tenant_id: tenantId,
      role: 'staff',
      name: cleanName,
      email: cleanEmail,
      password_hash: passwordHash,
      phone: phone ? String(phone).trim() : '',
      status: 'active',
    });

    // Ensure staff account is reliably persisted to Firestore
    try {
      await syncDocToFirestore('users', newStaff.id, newStaff);
    } catch (syncErr) {
      console.warn('[Staff] Warning persisting new staff to Firestore:', syncErr);
    }

    db.addAuditLog({
      tenant_id: tenantId,
      user_id: req.user?.id,
      user_email: req.user?.email,
      role: req.user?.role,
      action: 'STAFF_ACCOUNT_CREATED',
      resource_type: 'user',
      resource_id: newStaff.id,
      details: { name: cleanName, email: cleanEmail },
      ip: req.ip,
    });

    res.status(201).json({
      id: newStaff.id,
      name: newStaff.name,
      email: newStaff.email,
      role: newStaff.role,
      phone: newStaff.phone,
      status: newStaff.status,
    });
  } catch (err: any) {
    console.error('[Tenant Staff] Error adding staff:', err);
    res.status(500).json({ error: err?.message || 'Failed to add staff member.' });
  }
});

// DELETE /api/tenant/staff/:id (Owner only: Remove staff member)
router.delete('/staff/:id', requireRole('owner', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const user = db.getUserById(id);

  if (!user || user.tenant_id !== tenantId) {
    res.status(404).json({ error: 'Staff member not found in this printing press.' });
    return;
  }

  if (user.role === 'owner') {
    res.status(400).json({ error: 'The press owner account cannot be removed from staff list.' });
    return;
  }

  db.deleteUser(id, tenantId);

  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: 'STAFF_ACCOUNT_DELETED',
    resource_type: 'user',
    resource_id: id,
    details: { email: user.email, name: user.name },
    ip: req.ip,
  });

  res.json({ success: true, message: 'Staff member account removed.' });
});



// GET /api/tenant/settings (Owner only)
router.get('/settings', requireRole('owner', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const tenant = db.getTenantById(tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }
  res.json(tenant);
});

// PUT /api/tenant/settings (Owner only)
router.put('/settings', requireRole('owner', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const {
    name,
    phone,
    email,
    location,
    address,
    description,
    logo_url,
    settings,
  } = req.body;

  const current = db.getTenantById(tenantId);
  if (!current) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  const updatedTenant = db.updateTenant(tenantId, {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(location ? { location } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(logo_url ? { logo_url } : {}),
    settings: {
      ...current.settings,
      ...(settings || {}),
    },
  });

  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: 'TENANT_SETTINGS_UPDATED',
    resource_type: 'tenant',
    resource_id: tenantId,
    ip: req.ip,
  });

  res.json(updatedTenant);
});

// GET /api/tenant/analytics (Owner only)
router.get('/analytics', requireRole('owner', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const jobs = db.getPrintJobs(tenantId);
  const payments = db.getPayments(tenantId);

  // Colour vs B&W
  const colorJobs = jobs.filter((j) => j.options.color_mode === 'color').length;
  const bwJobs = jobs.filter((j) => j.options.color_mode === 'bw').length;

  // Paper sizes
  const paperSizes: Record<string, number> = {};
  jobs.forEach((j) => {
    paperSizes[j.options.paper_size] = (paperSizes[j.options.paper_size] || 0) + 1;
  });

  // Services popularity
  const serviceCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    if (j.options.binding && j.options.binding !== 'none') {
      serviceCounts[`Binding: ${j.options.binding}`] = (serviceCounts[`Binding: ${j.options.binding}`] || 0) + 1;
    }
    if (j.options.lamination && j.options.lamination !== 'none') {
      serviceCounts[`Lamination: ${j.options.lamination}`] = (serviceCounts[`Lamination: ${j.options.lamination}`] || 0) + 1;
    }
  });

  // Revenue totals
  const totalRevenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  res.json({
    totalJobs: jobs.length,
    totalRevenue,
    averageJobValue: jobs.length > 0 ? totalRevenue / jobs.length : 0,
    colorVsBw: { color: colorJobs, bw: bwJobs },
    paperSizes,
    servicePopularity: serviceCounts,
  });
});

// GET /api/tenant/audit-logs
router.get('/audit-logs', requireRole('owner', 'super_admin'), (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const logs = db.getAuditLogs(tenantId);
  res.json(logs);
});

export default router;
