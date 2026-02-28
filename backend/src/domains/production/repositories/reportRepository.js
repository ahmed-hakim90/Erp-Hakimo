import { BaseRepository } from './baseRepository.js';
import { supabaseAdmin } from '../../../config/supabaseAdmin.js';

class ReportRepository extends BaseRepository {
  constructor() {
    super('production_reports');
  }

  async getByDateRange(tenantId, startDate, endDate) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getByFilter(tenantId, filters = {}) {
    let q = this.query(tenantId);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') q = q.eq(key, value);
    });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }
}

export const reportRepository = new ReportRepository();
