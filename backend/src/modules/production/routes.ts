import { Router } from "express";
import { requireAuth, requirePermission } from "../../middlewares/auth.js";
import { WorkOrderService } from "./application/workOrder.service.js";
import { ReportService } from "./application/report.service.js";
import { ScanEventService } from "./application/scanEvent.service.js";
import { SupabaseWorkOrderRepository } from "./infrastructure/supabase/workOrder.repository.js";

const repo = new SupabaseWorkOrderRepository();
const workOrderService = new WorkOrderService(repo);
const reportService = new ReportService(repo);
const scanEventService = new ScanEventService(repo);
const asString = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
};

const toStatusFilter = (value?: string) => {
  if (!value) return undefined;
  const parts = value.split(",").map((v) => v.trim()).filter(Boolean);
  return parts.length <= 1 ? parts[0] : parts;
};

export const productionRoutes = Router();
productionRoutes.use(requireAuth);

productionRoutes.get(
  "/work-orders",
  requirePermission("workOrders.view"),
  async (req, res, next) => {
    try {
      const data = await workOrderService.list({
        lineId: req.query.lineId as string | undefined,
        productId: req.query.productId as string | undefined,
        supervisorId: req.query.supervisorId as string | undefined,
        planId: req.query.planId as string | undefined,
        status: toStatusFilter(req.query.status as string | undefined) as any,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.get(
  "/work-orders/:id",
  requirePermission("workOrders.view"),
  async (req, res, next) => {
    try {
      const id = asString(req.params.id as any);
      const data = await workOrderService.getById(id);
      if (!data) return res.status(404).json({ error: "Work order not found" });
      return res.json(data);
    } catch (err) {
      return next(err);
    }
  },
);

productionRoutes.post(
  "/work-orders",
  requirePermission("workOrders.manage"),
  async (req, res, next) => {
    try {
      const id = await workOrderService.create(req.body);
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.put(
  "/work-orders/:id",
  requirePermission("workOrders.manage"),
  async (req, res, next) => {
    try {
      const id = asString(req.params.id as any);
      await workOrderService.update(id, req.body);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.delete(
  "/work-orders/:id",
  requirePermission("workOrders.manage"),
  async (req, res, next) => {
    try {
      const id = asString(req.params.id as any);
      await workOrderService.delete(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.post(
  "/work-orders/generate-number",
  requirePermission("workOrders.manage"),
  async (_req, res, next) => {
    try {
      const number = await workOrderService.generateNextNumber();
      res.json({ number });
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.post(
  "/work-orders/:id/increment-produced",
  requirePermission("workOrders.manage"),
  async (req, res, next) => {
    try {
      const { quantityDelta, costDelta } = req.body as {
        quantityDelta: number;
        costDelta: number;
      };
      const id = asString(req.params.id as any);
      await workOrderService.incrementProduced(id, quantityDelta, costDelta);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.post(
  "/work-orders/:id/completion-from-scans",
  requirePermission("workOrders.manage"),
  async (req, res, next) => {
    try {
      const id = asString(req.params.id as any);
      await workOrderService.update(id, req.body);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.get(
  "/reports",
  requirePermission("reports.view"),
  async (req, res, next) => {
    try {
      const data = await reportService.list({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        lineId: req.query.lineId as string | undefined,
        productId: req.query.productId as string | undefined,
        employeeId: req.query.employeeId as string | undefined,
        workOrderId: req.query.workOrderId as string | undefined,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.get(
  "/reports/:id",
  requirePermission("reports.view"),
  async (req, res, next) => {
    try {
      const id = asString(req.params.id as any);
      const data = await reportService.getById(id);
      if (!data) return res.status(404).json({ error: "Report not found" });
      return res.json(data);
    } catch (err) {
      return next(err);
    }
  },
);

productionRoutes.post(
  "/reports",
  requirePermission("reports.manage"),
  async (req, res, next) => {
    try {
      const id = await reportService.create(req.body);
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.put(
  "/reports/:id",
  requirePermission("reports.manage"),
  async (req, res, next) => {
    try {
      const id = asString(req.params.id as any);
      await reportService.update(id, req.body);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.delete(
  "/reports/:id",
  requirePermission("reports.manage"),
  async (req, res, next) => {
    try {
      const id = asString(req.params.id as any);
      await reportService.delete(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.post(
  "/reports/backfill-missing-codes",
  requirePermission("reports.manage"),
  async (_req, res, next) => {
    try {
      const updated = await reportService.backfillMissingReportCodes();
      res.json({ updated });
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.get(
  "/scan-events",
  requirePermission("workOrders.view"),
  async (req, res, next) => {
    try {
      const data = await scanEventService.list({
        workOrderId: req.query.workOrderId as string | undefined,
        serialBarcode: req.query.serialBarcode as string | undefined,
        scanDate: req.query.scanDate as string | undefined,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.post(
  "/scan-events",
  requirePermission("workOrders.manage"),
  async (req, res, next) => {
    try {
      const id = await scanEventService.create(req.body);
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  },
);

productionRoutes.delete(
  "/scan-events/session",
  requirePermission("workOrders.manage"),
  async (req, res, next) => {
    try {
      const workOrderId = req.query.workOrderId as string;
      const sessionId = req.query.sessionId as string;
      await scanEventService.deleteSession(workOrderId, sessionId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

