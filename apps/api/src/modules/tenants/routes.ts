// =============================================================================
// Tenants Routes — GET /tenants, GET /tenants/:id, PATCH /tenants/:id
// Implements: DD-32 §5 (tenant management endpoints)
// ============================================================================

import { Router, Request, Response } from 'express';
import { getTenantById, getBillingStatus, updateTenant, listLocations, deactivateLocation } from './services/tenant-service.js';
import { validateTenantUpdate } from './validators.js';

export const tenantsRouter: Router = Router();

/** Guard: require req.user (set by auth middleware) */
function requireUser(req: Request, res: Response): string | null {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Authentication required' } });
    return null;
  }
  return req.user.tid;
}

/**
 * GET /tenants/:tenantId — get tenant by ID
 * DD-32 §5.2. Any authenticated user with tenant access.
 */
tenantsRouter.get('/tenants/:tenantId', async (req: Request, res: Response) => {
  const tid = requireUser(req, res);
  if (!tid) return;

  const tenant = await getTenantById(req.params.tenantId);
  if (!tenant) {
    return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Tenant not found' } });
  }
  return res.status(200).json({ success: true, data: tenant });
});

/**
 * PATCH /tenants/:tenantId — update tenant settings
 * DD-32 §5.3. Requires role = 'owner'.
 */
tenantsRouter.patch('/tenants/:tenantId', async (req: Request, res: Response) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Owner role required' } });
  }

  const errors = validateTenantUpdate(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors } });
  }

  // G-1/G-2: Check billing status before write
  const billingStatus = await getBillingStatus(req.params.tenantId);
  if (billingStatus === 'past_due' || billingStatus === 'cancelled') {
    return res.status(403).json({ success: false, error: { code: 'TENANT_SUSPENDED', message: 'Tenant billing inactive' } });
  }

  const updated = await updateTenant(req.params.tenantId, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Tenant not found' } });
  }
  return res.status(200).json({ success: true, data: updated });
});

/**
 * GET /tenants/:tenantId/locations — list locations
 * DD-32 §5 (locations sub-resource).
 */
tenantsRouter.get('/tenants/:tenantId/locations', async (req: Request, res: Response) => {
  const tid = requireUser(req, res);
  if (!tid) return;

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const locations = await listLocations(req.params.tenantId, limit, offset);
  return res.status(200).json({ success: true, data: locations });
});

/**
 * POST /tenants/:tenantId/locations/:locationId/deactivate — soft-deactivate
 */
tenantsRouter.post('/tenants/:tenantId/locations/:locationId/deactivate', async (req: Request, res: Response) => {
  if (!req.user || !['owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or owner required' } });
  }

  await deactivateLocation(req.params.locationId, req.params.tenantId);
  return res.status(200).json({ success: true, data: { deactivated: true } });
});
