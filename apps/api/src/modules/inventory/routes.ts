// =============================================================================
// Inventory Routes — Items, lots, and usage endpoints
// Implements: DD-32 §9 (inventory endpoints)
// ============================================================================

import { Router, Request, Response } from 'express';
import { listActiveItems, createLot, recordUsage, getUsageByLot } from './services/inventory-service.js';
import { validateRecordUsage, validateCreateLot } from './validators.js';

export const inventoryRouter: Router = Router();

const READ_ROLES = ['admin', 'clinical', 'staff'];
const WRITE_ROLES = ['admin', 'clinical'];

/** GET /inventory/items — list active inventory items */
inventoryRouter.get('/inventory/items', async (req: Request, res: Response) => {
  if (!req.user || !READ_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
  }
  const items = await listActiveItems(req.user.tid);
  return res.status(200).json({ success: true, data: items });
});

/** POST /inventory/lots — create new lot */
inventoryRouter.post('/inventory/lots', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const errors = validateCreateLot(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }
  const lotId = await createLot(req.user.tid, req.user.uid, {
    itemId: req.body.itemId,
    lotNumber: req.body.lotNumber,
    receivedDate: req.body.receivedDate ?? new Date().toISOString(),
    expirationDate: req.body.expirationDate,
    vendorId: req.body.vendorId,
    receivedQuantity: req.body.receivedQuantity,
    receivedUnitCost: req.body.receivedUnitCost ?? 0,
  });
  return res.status(201).json({ success: true, data: { lotId } });
});

/** POST /inventory/usage — record inventory usage */
inventoryRouter.post('/inventory/usage', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const errors = validateRecordUsage(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }
  try {
    const usageId = await recordUsage(req.user.tid, req.user.uid, {
      visitServiceId: req.body.visitServiceId,
      inventoryItemId: req.body.inventoryItemId,
      usageDate: req.body.usageDate ?? new Date().toISOString(),
      quantityUsed: req.body.quantityUsed,
      unitCostAtTime: req.body.unitCostAtTime,
      extendedCost: req.body.extendedCost ?? req.body.quantityUsed * req.body.unitCostAtTime,
      treatmentArea: req.body.treatmentArea,
    });
    return res.status(201).json({ success: true, data: { usageId } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('INVENTORY_INSUFFICIENT')) {
      return res.status(409).json({ success: false, error: { code: 'INVENTORY_INSUFFICIENT', message: msg } });
    }
    throw err;
  }
});

/** GET /inventory/usage/:lotId — get usage by lot (recall investigation) */
inventoryRouter.get('/inventory/usage/:lotId', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const usage = await getUsageByLot(req.params.lotId, req.user.tid);
  return res.status(200).json({ success: true, data: usage });
});
