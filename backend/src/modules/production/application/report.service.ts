import type { WorkOrderRepository } from "../domain/workOrder.repository.js";
import type { ProductionReport, ReportQuery } from "../domain/types.js";

export class ReportService {
  constructor(private readonly repo: WorkOrderRepository) {}

  list(filters?: ReportQuery): Promise<ProductionReport[]> {
    return this.repo.listReports(filters);
  }

  getById(id: string): Promise<ProductionReport | null> {
    return this.repo.getReportById(id);
  }

  async create(data: Omit<ProductionReport, "id" | "createdAt">): Promise<string> {
    const reportCode = data.reportCode || (await this.generateNextReportCode());
    return this.repo.createReport({
      ...data,
      reportCode,
      quantityWaste: data.quantityWaste ?? 0,
    });
  }

  async update(id: string, data: Partial<ProductionReport>): Promise<void> {
    await this.repo.updateReport(id, data);
  }

  async delete(id: string): Promise<void> {
    await this.repo.deleteReport(id);
  }

  async backfillMissingReportCodes(): Promise<number> {
    const reports = await this.repo.listReports();
    const missing = reports.filter((r) => !r.reportCode);
    if (missing.length === 0) return 0;

    let updated = 0;
    for (const report of missing) {
      if (!report.id) continue;
      const reportCode = await this.generateNextReportCode();
      await this.repo.updateReport(report.id, { reportCode });
      updated++;
    }
    return updated;
  }

  private async generateNextReportCode(): Promise<string> {
    const year = new Date().getFullYear();
    const reports = await this.repo.listReports();
    const latest = reports.find((r) => !!r.reportCode)?.reportCode ?? "";
    const match = /^PR-(\d{4})-(\d+)$/.exec(latest);
    if (!match || Number(match[1]) !== year) return `PR-${year}-0001`;
    const codeSeq = Number(match[2]) || 0;
    return `PR-${year}-${String(codeSeq + 1).padStart(4, "0")}`;
  }
}

