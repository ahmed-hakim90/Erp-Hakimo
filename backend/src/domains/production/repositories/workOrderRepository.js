import { BaseRepository } from './baseRepository.js';
import { supabaseAdmin } from '../../../config/supabaseAdmin.js';

class WorkOrderRepository extends BaseRepository {
  constructor() {
    super('work_orders');
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

  async getActiveByLine(tenantId, lineId) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('line_id', lineId)
      .in('status', ['pending', 'in_progress']);
    if (error) throw error;
    return data || [];
  }

  async getLatestForNumber(tenantId) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
}

export const workOrderRepository = new WorkOrderRepository();
