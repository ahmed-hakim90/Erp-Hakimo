import { supabaseAdmin } from "../../../../config/supabase.js";
import type { WorkOrderRepository } from "../../domain/workOrder.repository.js";
import type {
  ProductionReport,
  ReportQuery,
  ScanEventQuery,
  WorkOrder,
  WorkOrderQuery,
  WorkOrderScanEvent,
  WorkOrderStatus,
} from "../../domain/types.js";

const WORK_ORDERS_TABLE = "work_orders";
const REPORTS_TABLE = "production_reports";
const SCAN_EVENTS_TABLE = "scan_events";

const sanitizeStatus = (status?: WorkOrderStatus | WorkOrderStatus[]) =>
  Array.isArray(status) ? status : status ? [status] : undefined;

export class SupabaseWorkOrderRepository implements WorkOrderRepository {
  async listWorkOrders(filters?: WorkOrderQuery): Promise<WorkOrder[]> {
    let query = supabaseAdmin.from(WORK_ORDERS_TABLE).select("*");

    if (filters?.lineId) query = query.eq("lineId", filters.lineId);
    if (filters?.planId) query = query.eq("planId", filters.planId);
    if (filters?.supervisorId) query = query.eq("supervisorId", filters.supervisorId);
    if (filters?.productId) query = query.eq("productId", filters.productId);

    const statuses = sanitizeStatus(filters?.status);
    if (statuses?.length) query = query.in("status", statuses);

    const { data, error } = await query.order("createdAt", { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkOrder[];
  }

  async getWorkOrderById(id: string): Promise<WorkOrder | null> {
    const { data, error } = await supabaseAdmin
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as WorkOrder | null) ?? null;
  }

  async createWorkOrder(data: Omit<WorkOrder, "id" | "createdAt">): Promise<string> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const { data: inserted, error } = await supabaseAdmin
      .from(WORK_ORDERS_TABLE)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return inserted.id as string;
  }

  async updateWorkOrder(id: string, data: Partial<WorkOrder>): Promise<void> {
    const { id: _ignored, createdAt: _ignored2, ...fields } = data;
    const { error } = await supabaseAdmin.from(WORK_ORDERS_TABLE).update(fields).eq("id", id);
    if (error) throw error;
  }

  async deleteWorkOrder(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from(WORK_ORDERS_TABLE).delete().eq("id", id);
    if (error) throw error;
  }

  async incrementProduced(id: string, quantityDelta: number, costDelta: number): Promise<void> {
    const current = await this.getWorkOrderById(id);
    if (!current) throw new Error("Work order not found");
    const producedQuantity = Number(current.producedQuantity ?? 0) + Number(quantityDelta || 0);
    const actualCost = Number(current.actualCost ?? 0) + Number(costDelta || 0);
    await this.updateWorkOrder(id, { producedQuantity, actualCost });
  }

  async listReports(filters?: ReportQuery): Promise<ProductionReport[]> {
    let query = supabaseAdmin.from(REPORTS_TABLE).select("*");
    if (filters?.lineId) query = query.eq("lineId", filters.lineId);
    if (filters?.productId) query = query.eq("productId", filters.productId);
    if (filters?.employeeId) query = query.eq("employeeId", filters.employeeId);
    if (filters?.workOrderId) query = query.eq("workOrderId", filters.workOrderId);
    if (filters?.startDate) query = query.gte("date", filters.startDate);
    if (filters?.endDate) query = query.lte("date", filters.endDate);
    const { data, error } = await query.order("date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ProductionReport[];
  }

  async getReportById(id: string): Promise<ProductionReport | null> {
    const { data, error } = await supabaseAdmin
      .from(REPORTS_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as ProductionReport | null) ?? null;
  }

  async createReport(data: Omit<ProductionReport, "id" | "createdAt">): Promise<string> {
    const payload = { ...data, createdAt: new Date().toISOString() };
    const { data: inserted, error } = await supabaseAdmin
      .from(REPORTS_TABLE)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return inserted.id as string;
  }

  async updateReport(id: string, data: Partial<ProductionReport>): Promise<void> {
    const { id: _ignored, createdAt: _ignored2, ...fields } = data;
    const { error } = await supabaseAdmin.from(REPORTS_TABLE).update(fields).eq("id", id);
    if (error) throw error;
  }

  async deleteReport(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from(REPORTS_TABLE).delete().eq("id", id);
    if (error) throw error;
  }

  async listScanEvents(filters?: ScanEventQuery): Promise<WorkOrderScanEvent[]> {
    let query = supabaseAdmin.from(SCAN_EVENTS_TABLE).select("*");
    if (filters?.workOrderId) query = query.eq("workOrderId", filters.workOrderId);
    if (filters?.serialBarcode) query = query.eq("serialBarcode", filters.serialBarcode);
    if (filters?.scanDate) query = query.eq("scanDate", filters.scanDate);

    const { data, error } = await query.order("timestamp", { ascending: true });
    if (error) throw error;
    return (data ?? []) as WorkOrderScanEvent[];
  }

  async createScanEvent(
    data: Omit<WorkOrderScanEvent, "id" | "timestamp"> & { timestamp?: string },
  ): Promise<string> {
    const payload = { ...data, timestamp: data.timestamp ?? new Date().toISOString() };
    const { data: inserted, error } = await supabaseAdmin
      .from(SCAN_EVENTS_TABLE)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return inserted.id as string;
  }

  async deleteScanSession(workOrderId: string, sessionId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from(SCAN_EVENTS_TABLE)
      .delete()
      .eq("workOrderId", workOrderId)
      .eq("sessionId", sessionId);
    if (error) throw error;
  }
}

