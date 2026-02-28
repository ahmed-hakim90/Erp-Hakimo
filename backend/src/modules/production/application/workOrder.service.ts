import type { WorkOrderRepository } from "../domain/workOrder.repository.js";
import type { WorkOrder, WorkOrderQuery } from "../domain/types.js";

export class WorkOrderService {
  constructor(private readonly repo: WorkOrderRepository) {}

  list(filters?: WorkOrderQuery): Promise<WorkOrder[]> {
    return this.repo.listWorkOrders(filters);
  }

  getById(id: string): Promise<WorkOrder | null> {
    return this.repo.getWorkOrderById(id);
  }

  async create(data: Omit<WorkOrder, "id" | "createdAt">): Promise<string> {
    return this.repo.createWorkOrder(data);
  }

  async update(id: string, data: Partial<WorkOrder>): Promise<void> {
    await this.repo.updateWorkOrder(id, data);
  }

  async delete(id: string): Promise<void> {
    await this.repo.deleteWorkOrder(id);
  }

  async incrementProduced(id: string, quantityDelta: number, costDelta: number): Promise<void> {
    await this.repo.incrementProduced(id, quantityDelta, costDelta);
  }

  async generateNextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const orders = await this.repo.listWorkOrders();
    if (orders.length === 0) return `WO-${year}-0001`;

    const sorted = [...orders].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
    const lastNum = sorted[0]?.workOrderNumber ?? "";
    const parts = lastNum.split("-");
    const seq = Number(parts[parts.length - 1]) || 0;
    return `WO-${year}-${String(seq + 1).padStart(4, "0")}`;
  }
}

