import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, UserRole } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'printflow-production-jwt-secret-key-2026';

export interface AuthUser {
  id: string;
  tenant_id: string | null;
  role: UserRole;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing or invalid Bearer token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    // Verify user is still active in database (check memory, fallback to Firestore)
    let user = db.getUserById(decoded.id);
    if (!user) {
      user = await db.getUserByIdAsync(decoded.id);
    }

    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'User account is deactivated or not found.' });
      return;
    }

    req.user = {
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email,
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized. Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' does not have access to this resource.`,
      });
      return;
    }

    next();
  };
}

/**
 * Strict Tenant Isolation Middleware:
 * Ensures the authenticated user can ONLY access resources belonging to their own tenant.
 * Super Admins are permitted to cross tenant boundaries for management/audit purposes.
 */
export function verifyTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  // Super Admin has platform-wide oversight
  if (req.user.role === 'super_admin') {
    const requested = (req.query.tenant_id as string) || (req.headers['x-tenant-id'] as string) || req.params.tenantId;
    if (requested) {
      req.tenantId = requested;
      req.params.tenantId = requested;
    } else if (req.user.tenant_id) {
      req.tenantId = req.user.tenant_id;
      req.params.tenantId = req.user.tenant_id;
    }
    next();
    return;
  }

  const requestedTenantId = req.params.tenantId || req.body.tenant_id || req.query.tenant_id || (req.headers['x-tenant-id'] as string);
  
  if (!req.user.tenant_id) {
    res.status(403).json({ error: 'Forbidden. User has no assigned printing press tenant.' });
    return;
  }

  // If a specific tenant ID was specified in route params, verify exact match
  if (requestedTenantId && requestedTenantId !== req.user.tenant_id) {
    // Log unauthorized cross-tenant attempt
    db.addAuditLog({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      user_email: req.user.email,
      role: req.user.role,
      action: 'SECURITY_CROSS_TENANT_VIOLATION_BLOCKED',
      resource_type: 'tenant',
      resource_id: String(requestedTenantId),
      details: {
        attempted_tenant_id: requestedTenantId,
        user_tenant_id: req.user.tenant_id,
        path: req.originalUrl,
      },
      ip: req.ip || req.socket.remoteAddress,
    });

    res.status(403).json({
      error: 'Access Denied: Multi-tenant boundary violation. You cannot access another printing press data.',
    });
    return;
  }

  // Enforce tenant ID context on the request
  req.tenantId = req.user.tenant_id;
  req.params.tenantId = req.user.tenant_id;
  next();
}
