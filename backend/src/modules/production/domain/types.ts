export type WorkOrderStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface WorkOrder {
  id?: string;
  workOrderNumber: string;
  planId?: string;
  productId: string;
  lineId: string;
  supervisorId: string;
  quantity: number;
  producedQuantity: number;
  maxWorkers: number;
  targetDate: string;
  estimatedCost: number;
  actualCost: number;
  status: WorkOrderStatus;
  notes?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  workdayEndTime?: string;
  scanPauseWindows?: Array<{ startAt: string; endAt?: string; reason: "manual" }>;
  actualWorkersCount?: number;
  actualProducedFromScans?: number;
  actualWorkHours?: number;
  scanSummary?: Record<string, unknown>;
  scanSessionClosedAt?: string;
  qualityStatus?: "pending" | "approved" | "rejected" | "not_required";
  qualitySummary?: Record<string, unknown>;
  qualityReportCode?: string;
  qualityApprovedBy?: string;
  qualityApprovedAt?: string;
  createdBy?: string;
  createdAt?: string;
  completedAt?: string | null;
}

export interface ProductionReport {
  id?: string;
  reportCode?: string;
  employeeId: string;
  productId: string;
  lineId: string;
  date: string;
  quantityProduced: number;
  quantityWaste: number;
  workersCount: number;
  workHours: number;
  notes?: string;
  workOrderId?: string;
  createdAt?: string;
}

export interface WorkOrderScanEvent {
  id?: string;
  workOrderId: string;
  lineId: string;
  productId: string;
  serialBarcode: string;
  employeeId?: string;
  action: "IN" | "OUT";
  timestamp: string;
  scanDate: string;
  sessionId: string;
  cycleSeconds?: number;
}

export interface WorkOrderQuery {
  lineId?: string;
  planId?: string;
  supervisorId?: string;
  productId?: string;
  status?: WorkOrderStatus | WorkOrderStatus[];
}

export interface ReportQuery {
  startDate?: string;
  endDate?: string;
  lineId?: string;
  productId?: string;
  employeeId?: string;
  workOrderId?: string;
}

export interface ScanEventQuery {
  workOrderId?: string;
  serialBarcode?: string;
  scanDate?: string;
}

