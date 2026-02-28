import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { toCamel, toSnake } from '../../utils/case.js';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac.js';
import { productRepository } from './repositories/productRepository.js';
import { lineRepository } from './repositories/lineRepository.js';
import { lineStatusRepository } from './repositories/lineStatusRepository.js';
import { lineProductConfigRepository } from './repositories/lineProductConfigRepository.js';
import { productionPlanRepository } from './repositories/productionPlanRepository.js';
import { workOrderRepository } from './repositories/workOrderRepository.js';
import { reportRepository } from './repositories/reportRepository.js';
import { lineAssignmentRepository } from './repositories/lineAssignmentRepository.js';
import { productMaterialRepository } from './repositories/productMaterialRepository.js';
import { scanEventRepository } from './repositories/scanEventRepository.js';

const router = Router();

const readProduction = requireAnyPermission([
  'products.view',
  'lines.view',
  'reports.view',
  'plans.view',
  'workOrders.view',
  'lineStatus.view',
  'lineProductConfig.view',
  'quickAction.view',
]);

const writeProducts = requireAnyPermission(['products.create', 'products.edit', 'products.delete']);
const writeLines = requireAnyPermission(['lines.create', 'lines.edit', 'lines.delete']);
const writeReports = requireAnyPermission(['reports.create', 'reports.edit', 'reports.delete']);
const writePlans = requireAnyPermission(['plans.create', 'plans.edit']);
const writeWorkOrders = requireAnyPermission(['workOrders.create', 'workOrders.edit', 'workOrders.delete']);
const writeLineStatus = requirePermission('lineStatus.edit');
const writeLineWorkers = requirePermission('lineWorkers.view');

const asJson = (res, data) => res.json(Array.isArray(data) ? data.map(toCamel) : toCamel(data));

const bindCrud = ({ basePath, repository, readGuard, writeGuard }) => {
  router.get(basePath, readGuard, asyncHandler(async (req, res) => {
    const rows = await repository.getAll(req.tenantId);
    asJson(res, rows);
  }));

  router.get(`${basePath}/:id`, readGuard, asyncHandler(async (req, res) => {
    const row = await repository.getById(req.params.id, req.tenantId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return asJson(res, row);
  }));

  router.post(basePath, writeGuard, asyncHandler(async (req, res) => {
    const id = await repository.create(toSnake(req.body), req.tenantId);
    return res.json({ id });
  }));

  router.patch(`${basePath}/:id`, writeGuard, asyncHandler(async (req, res) => {
    await repository.update(req.params.id, toSnake(req.body), req.tenantId);
    res.status(204).send();
  }));

  router.delete(`${basePath}/:id`, writeGuard, asyncHandler(async (req, res) => {
    await repository.remove(req.params.id, req.tenantId);
    res.status(204).send();
  }));
};

bindCrud({ basePath: '/products', repository: productRepository, readGuard: readProduction, writeGuard: writeProducts });
bindCrud({ basePath: '/lines', repository: lineRepository, readGuard: readProduction, writeGuard: writeLines });
bindCrud({ basePath: '/line-statuses', repository: lineStatusRepository, readGuard: readProduction, writeGuard: writeLineStatus });
bindCrud({ basePath: '/line-product-configs', repository: lineProductConfigRepository, readGuard: readProduction, writeGuard: writeLines });
bindCrud({ basePath: '/production-plans', repository: productionPlanRepository, readGuard: readProduction, writeGuard: writePlans });
bindCrud({ basePath: '/work-orders', repository: workOrderRepository, readGuard: readProduction, writeGuard: writeWorkOrders });
bindCrud({ basePath: '/reports', repository: reportRepository, readGuard: readProduction, writeGuard: writeReports });
bindCrud({ basePath: '/line-assignments', repository: lineAssignmentRepository, readGuard: readProduction, writeGuard: writeLineWorkers });
bindCrud({ basePath: '/product-materials', repository: productMaterialRepository, readGuard: readProduction, writeGuard: writeProducts });

router.get('/production-plans/active/by-line/:lineId', readProduction, asyncHandler(async (req, res) => {
  const rows = await productionPlanRepository.getAll(req.tenantId);
  const data = rows.filter((p) => p.line_id === req.params.lineId && ['planned', 'in_progress'].includes(p.status));
  asJson(res, data);
}));

router.get('/production-plans/active/by-line-product', readProduction, asyncHandler(async (req, res) => {
  const { lineId, productId } = req.query;
  const rows = await productionPlanRepository.getAll(req.tenantId);
  const data = rows.filter((p) =>
    p.line_id === lineId && p.product_id === productId && ['planned', 'in_progress'].includes(p.status),
  );
  asJson(res, data);
}));

router.post('/production-plans/:id/increment-produced', writePlans, asyncHandler(async (req, res) => {
  const current = await productionPlanRepository.getById(req.params.id, req.tenantId);
  if (!current) return res.status(404).json({ error: 'Not found' });
  const quantityDelta = Number(req.body.quantityDelta || 0);
  const costDelta = Number(req.body.costDelta || 0);
  await productionPlanRepository.update(req.params.id, {
    produced_quantity: Number(current.produced_quantity || 0) + quantityDelta,
    actual_cost: Number(current.actual_cost || 0) + costDelta,
  }, req.tenantId);
  res.status(204).send();
}));

router.get('/work-orders/filters', readProduction, asyncHandler(async (req, res) => {
  const filters = toSnake({
    lineId: req.query.lineId,
    planId: req.query.planId,
    supervisorId: req.query.supervisorId,
    productId: req.query.productId,
  });
  const rows = await workOrderRepository.getByFilter(req.tenantId, filters);
  asJson(res, rows);
}));

router.get('/work-orders/active/by-line/:lineId', readProduction, asyncHandler(async (req, res) => {
  const rows = await workOrderRepository.getActiveByLine(req.tenantId, req.params.lineId);
  asJson(res, rows);
}));

router.get('/work-orders/active/by-line-product', readProduction, asyncHandler(async (req, res) => {
  const rows = await workOrderRepository.getByFilter(req.tenantId, {
    line_id: req.query.lineId,
    product_id: req.query.productId,
  });
  asJson(res, rows.filter((r) => ['pending', 'in_progress'].includes(r.status)));
}));

router.post('/work-orders/generate-next-number', readProduction, asyncHandler(async (req, res) => {
  const latest = await workOrderRepository.getLatestForNumber(req.tenantId);
  const year = new Date().getFullYear();
  if (!latest?.work_order_number) return res.json({ value: `WO-${year}-0001` });
  const parts = String(latest.work_order_number).split('-');
  const seq = Number(parts[parts.length - 1] || 0);
  return res.json({ value: `WO-${year}-${String(seq + 1).padStart(4, '0')}` });
}));

router.post('/work-orders/:id/increment-produced', writeWorkOrders, asyncHandler(async (req, res) => {
  const current = await workOrderRepository.getById(req.params.id, req.tenantId);
  if (!current) return res.status(404).json({ error: 'Not found' });
  const quantityDelta = Number(req.body.quantityDelta || 0);
  const costDelta = Number(req.body.costDelta || 0);
  await workOrderRepository.update(req.params.id, {
    produced_quantity: Number(current.produced_quantity || 0) + quantityDelta,
    actual_cost: Number(current.actual_cost || 0) + costDelta,
  }, req.tenantId);
  res.status(204).send();
}));

router.post('/work-orders/:id/update-completion-from-scans', writeWorkOrders, asyncHandler(async (req, res) => {
  await workOrderRepository.update(req.params.id, toSnake(req.body), req.tenantId);
  res.status(204).send();
}));

router.get('/reports/date-range', readProduction, asyncHandler(async (req, res) => {
  const rows = await reportRepository.getByDateRange(req.tenantId, req.query.startDate, req.query.endDate);
  asJson(res, rows);
}));

router.get('/reports/filters', readProduction, asyncHandler(async (req, res) => {
  const filters = toSnake({
    lineId: req.query.lineId,
    productId: req.query.productId,
    employeeId: req.query.employeeId,
    workOrderId: req.query.workOrderId,
  });
  const rows = await reportRepository.getByFilter(req.tenantId, filters);
  asJson(res, rows);
}));

router.get('/reports/exists/line-date', readProduction, asyncHandler(async (req, res) => {
  const rows = await reportRepository.getByFilter(req.tenantId, {
    line_id: req.query.lineId,
    date: req.query.date,
  });
  res.json({ exists: rows.length > 0 });
}));

router.post('/reports/backfill-report-codes', writeReports, asyncHandler(async (_req, res) => {
  // Placeholder for phased migration safety; implemented in later migration phase.
  res.json({ updated: 0 });
}));

router.get('/line-assignments/by-date/:date', readProduction, asyncHandler(async (req, res) => {
  const rows = await lineAssignmentRepository.getByDate(req.tenantId, req.params.date);
  asJson(res, rows);
}));

router.get('/line-assignments/by-line-date', readProduction, asyncHandler(async (req, res) => {
  const rows = await lineAssignmentRepository.getByLineAndDate(req.tenantId, req.query.lineId, req.query.date);
  asJson(res, rows);
}));

router.delete('/line-assignments/delete-by-line-date', writeLineWorkers, asyncHandler(async (req, res) => {
  const rows = await lineAssignmentRepository.getByLineAndDate(req.tenantId, req.query.lineId, req.query.date);
  await Promise.all(rows.map((row) => lineAssignmentRepository.remove(row.id, req.tenantId)));
  res.status(204).send();
}));

router.post('/line-assignments/copy-from-date', writeLineWorkers, asyncHandler(async (req, res) => {
  const sourceDate = req.body.sourceDate;
  const targetDate = req.body.targetDate;
  const lineId = req.body.lineId;
  const assignedBy = req.body.assignedBy || '';
  const sourceRows = lineId
    ? await lineAssignmentRepository.getByLineAndDate(req.tenantId, lineId, sourceDate)
    : await lineAssignmentRepository.getByDate(req.tenantId, sourceDate);
  const existing = lineId
    ? await lineAssignmentRepository.getByLineAndDate(req.tenantId, lineId, targetDate)
    : await lineAssignmentRepository.getByDate(req.tenantId, targetDate);
  const existingKeys = new Set(existing.map((r) => `${r.line_id}_${r.employee_id}`));
  let copied = 0;
  for (const row of sourceRows) {
    const key = `${row.line_id}_${row.employee_id}`;
    if (existingKeys.has(key)) continue;
    await lineAssignmentRepository.create({
      line_id: row.line_id,
      employee_id: row.employee_id,
      employee_code: row.employee_code,
      employee_name: row.employee_name,
      date: targetDate,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString(),
    }, req.tenantId);
    copied += 1;
  }
  res.json({ copied });
}));

router.get('/product-materials/by-product/:productId', readProduction, asyncHandler(async (req, res) => {
  const rows = await productMaterialRepository.getByProduct(req.tenantId, req.params.productId);
  asJson(res, rows);
}));

router.get('/scan-events/by-work-order/:workOrderId', readProduction, asyncHandler(async (req, res) => {
  const rows = await scanEventRepository.getByWorkOrder(req.tenantId, req.params.workOrderId);
  asJson(res, rows);
}));

router.get('/scan-events/by-work-order-serial', readProduction, asyncHandler(async (req, res) => {
  const rows = await scanEventRepository.getByWorkOrderAndSerial(req.tenantId, req.query.workOrderId, req.query.serialBarcode);
  asJson(res, rows);
}));

router.delete('/scan-events/delete-session', writeWorkOrders, asyncHandler(async (req, res) => {
  const rows = await scanEventRepository.getByWorkOrder(req.tenantId, req.query.workOrderId);
  const related = rows.filter((r) => r.session_id === req.query.sessionId);
  await Promise.all(related.map((row) => scanEventRepository.remove(row.id, req.tenantId)));
  res.status(204).send();
}));

router.post('/scan-events/toggle', writeWorkOrders, asyncHandler(async (req, res) => {
  const payload = req.body;
  const serial = String(payload.serialBarcode || '').trim();
  if (!serial) return res.status(400).json({ error: 'Serial barcode is required' });

  const events = await scanEventRepository.getByWorkOrderAndSerial(req.tenantId, payload.workOrderId, serial);
  const last = events[events.length - 1];
  const now = new Date();

  if (!last || last.action === 'OUT') {
    const sessionId = `${payload.workOrderId}_${serial}_${Date.now()}`;
    const id = await scanEventRepository.create({
      work_order_id: payload.workOrderId,
      line_id: payload.lineId,
      product_id: payload.productId,
      serial_barcode: serial,
      employee_id: payload.employeeId || null,
      action: 'IN',
      session_id: sessionId,
      scan_date: now.toISOString().slice(0, 10),
      timestamp: now.toISOString(),
    }, req.tenantId);
    return res.json({ action: 'IN', eventId: id, sessionId });
  }

  const cycleSeconds = Math.max(
    1,
    Math.floor((Date.now() - new Date(last.timestamp).getTime()) / 1000),
  );
  const id = await scanEventRepository.create({
    work_order_id: payload.workOrderId,
    line_id: payload.lineId,
    product_id: payload.productId,
    serial_barcode: serial,
    employee_id: payload.employeeId || null,
    action: 'OUT',
    session_id: last.session_id,
    cycle_seconds: cycleSeconds,
    scan_date: now.toISOString().slice(0, 10),
    timestamp: now.toISOString(),
  }, req.tenantId);

  return res.json({ action: 'OUT', eventId: id, sessionId: last.session_id, cycleSeconds });
}));

export { router as productionRouter };
