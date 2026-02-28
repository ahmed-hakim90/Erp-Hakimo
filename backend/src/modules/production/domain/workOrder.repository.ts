import type {
  ProductionReport,
  ReportQuery,
  ScanEventQuery,
  WorkOrder,
  WorkOrderQuery,
  WorkOrderScanEvent,
} from "./types.js";

export interface WorkOrderRepository {
  listWorkOrders(filters?: WorkOrderQuery): Promise<WorkOrder[]>;
  getWorkOrderById(id: string): Promise<WorkOrder | null>;
  createWorkOrder(data: Omit<WorkOrder, "id" | "createdAt">): Promise<string>;
  updateWorkOrder(id: string, data: Partial<WorkOrder>): Promise<void>;
  deleteWorkOrder(id: string): Promise<void>;
  incrementProduced(id: string, quantityDelta: number, costDelta: number): Promise<void>;

  listReports(filters?: ReportQuery): Promise<ProductionReport[]>;
  getReportById(id: string): Promise<ProductionReport | null>;
  createReport(data: Omit<ProductionReport, "id" | "createdAt">): Promise<string>;
  updateReport(id: string, data: Partial<ProductionReport>): Promise<void>;
  deleteReport(id: string): Promise<void>;

  listScanEvents(filters?: ScanEventQuery): Promise<WorkOrderScanEvent[]>;
  createScanEvent(
    data: Omit<WorkOrderScanEvent, "id" | "timestamp"> & { timestamp?: string },
  ): Promise<string>;
  deleteScanSession(workOrderId: string, sessionId: string): Promise<void>;
}

