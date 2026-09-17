import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authenticate, requireRole, generateToken } from '../auth';

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(requireRole('super_admin'));

// GET /api/admin/stats
router.get('/stats', (_req: Request, res: Response) => {
  const tenants = db.getTenants();
  const allJobs = db.getAllPrintJobs();
  const allPayments = db.getPayments();
  const subscriptions = db.getSubscriptions();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const activeTenants = tenants.filter((t) => t.status === 'active').length;
  const pendingTenants = tenants.filter((t) => t.status === 'pending_approval').length;
  const suspendedTenants = tenants.filter((t) => t.status === 'suspended').length;

  const totalPlatformVolume = allPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const subscriptionRevenue = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + s.monthly_price, 0);

  const jobsToday = allJobs.filter((j) => new Date(j.created_at).getTime() >= startOfToday).length;
  const completedJobs = allJobs.filter((j) => j.job_status === 'completed').length;

  res.json({
    tenants: {
      total: tenants.length,
      active: activeTenants,
      pending: pendingTenants,
      suspended: suspendedTenants,
    },
    jobs: {
      total: allJobs.length,
      today: jobsToday,
      completed: completedJobs,
    },
    revenue: {
      platformVolumeGHS: totalPlatformVolume,
      subscriptionMonthlyGHS: subscriptionRevenue,
    },
  });
});

// GET /api/admin/presses (List all printing presses with filter)
router.get('/presses', (req: Request, res: Response) => {
  const { status } = req.query;
  let tenants = db.getTenants();

  if (status && status !== 'all') {
    tenants = tenants.filter((t) => t.status === status);
  }

  const enriched = tenants.map((t) => {
    const jobs = db.getPrintJobs(t.id);
    const sub = db.getSubscriptionByTenantId(t.id);
    return {
      ...t,
      jobCount: jobs.length,
      subscription: sub,
    };
  });

  res.json(enriched);
});

// PATCH /api/admin/presses/:id/status (Approve, reject, activate, suspend)
router.patch('/presses/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  if (!['active', 'pending_approval', 'suspended'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const tenant = db.getTenantById(id);
  if (!tenant) {
    res.status(404).json({ error: 'Printing press not found.' });
    return;
  }

  const previousStatus = tenant.status;
  const updatedTenant = db.updateTenant(id, { status });

  // Update or activate subscription if newly approved
  if (status === 'active' && previousStatus === 'pending_approval') {
    if (!db.getSubscriptionByTenantId(id)) {
      // Auto-assign Free or Starter plan
      const now = new Date();
      const renews = new Date(now.getTime() + 30 * 86400000);
      db.updateSubscription(id, {
        tenant_id: id,
        plan_name: 'Free',
        monthly_price: 0,
        status: 'active',
        max_jobs_per_month: 50,
        current_month_jobs: 0,
        starts_at: now.toISOString(),
        renews_at: renews.toISOString(),
      });
    }
  }

  // Audit log
  db.addAuditLog({
    tenant_id: id,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: 'super_admin',
    action: `PRESS_STATUS_${status.toUpperCase()}`,
    resource_type: 'tenant',
    resource_id: id,
    details: {
      business_name: tenant.name,
      previousStatus,
      newStatus: status,
      rejection_reason,
    },
    ip: req.ip,
  });

  res.json({
    message: `Printing press status changed to ${status}.`,
    tenant: updatedTenant,
  });
});

// DELETE /api/admin/presses/:id (Delete registered company and all associated records)
router.delete('/presses/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tenant = db.getTenantById(id);
  if (!tenant) {
    res.status(404).json({ error: 'Printing press not found.' });
    return;
  }

  const businessName = tenant.name;
  const success = db.deleteTenant(id);
  if (!success) {
    res.status(500).json({ error: 'Failed to delete printing press.' });
    return;
  }

  res.json({
    message: `Printing press "${businessName}" has been permanently deleted.`,
    id,
  });
});

// GET /api/admin/subscriptions
router.get('/subscriptions', (_req: Request, res: Response) => {
  const subscriptions = db.getSubscriptions();
  const tenants = db.getTenants();

  const joined = subscriptions.map((s) => {
    const tenant = tenants.find((t) => t.id === s.tenant_id);
    return {
      ...s,
      tenant_name: tenant?.name || 'Unknown',
      tenant_slug: tenant?.slug || '',
    };
  });

  res.json(joined);
});

// PUT /api/admin/subscriptions/:tenantId (Update tenant plan)
router.put('/subscriptions/:tenantId', (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { plan_name, monthly_price, max_jobs_per_month } = req.body;

  const updated = db.updateSubscription(tenantId, {
    ...(plan_name ? { plan_name } : {}),
    ...(monthly_price !== undefined ? { monthly_price: parseFloat(monthly_price) } : {}),
    ...(max_jobs_per_month !== undefined ? { max_jobs_per_month: parseInt(max_jobs_per_month, 10) } : {}),
  });

  if (!updated) {
    res.status(404).json({ error: 'Subscription not found for this tenant.' });
    return;
  }

  res.json(updated);
});

// GET /api/admin/audit-logs (Platform-wide audit trail)
router.get('/audit-logs', (req: Request, res: Response) => {
  const logs = db.getAuditLogs();
  res.json(logs);
});

// GET /api/admin/jobs (Platform-wide job inspection)
router.get('/jobs', (_req: Request, res: Response) => {
  const jobs = db.getAllPrintJobs().slice(0, 100);
  const tenants = db.getTenants();

  const enriched = jobs.map((j) => {
    const tenant = tenants.find((t) => t.id === j.tenant_id);
    return {
      ...j,
      tenant_name: tenant?.name || 'Unknown Press',
      tenant_location: tenant?.location || '',
    };
  });

  res.json(enriched);
});

// GET /api/admin/database (Live Firestore connection & collection status)
router.get('/database', async (_req: Request, res: Response) => {
  try {
    const dbInfo = await db.getDatabaseInfo();
    res.json(dbInfo);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve database status' });
  }
});

// POST /api/admin/database/sync (Trigger full sync to Cloud Firestore)
router.post('/database/sync', async (_req: Request, res: Response) => {
  try {
    const result = await db.syncAllToFirestore();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Sync failed' });
  }
});

// POST /api/admin/impersonate (Super admin authenticated access to inspect or support a press)
router.post('/impersonate', (req: Request, res: Response) => {
  const { tenantSlug, tenantId } = req.body;
  const tenant = tenantSlug ? db.getTenantBySlug(tenantSlug) : (tenantId ? db.getTenantById(tenantId) : null);
  if (!tenant) {
    res.status(404).json({ error: 'Printing press not found.' });
    return;
  }

  // Find owner user for this tenant
  let targetUser = db.getUsers().find((u) => u.tenant_id === tenant.id && u.role === 'owner');
  if (!targetUser) {
    targetUser = db.getUsers().find((u) => u.tenant_id === tenant.id);
  }

  if (!targetUser) {
    res.status(404).json({ error: 'No user account found for this printing press.' });
    return;
  }

  const token = generateToken({
    id: targetUser.id,
    tenant_id: targetUser.tenant_id,
    role: targetUser.role,
    name: targetUser.name,
    email: targetUser.email,
  });

  db.addAuditLog({
    tenant_id: tenant.id,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: 'super_admin',
    action: 'SUPER_ADMIN_IMPERSONATE_PRESS',
    resource_type: 'tenant',
    resource_id: tenant.id,
    ip: req.ip,
  });

  res.json({
    token,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      phone: targetUser.phone,
      tenant_id: targetUser.tenant_id,
    },
    tenant,
  });
});

export default router;
