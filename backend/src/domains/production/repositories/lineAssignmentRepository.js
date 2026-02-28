import { BaseRepository } from './baseRepository.js';
import { supabaseAdmin } from '../../../config/supabaseAdmin.js';

class LineAssignmentRepository extends BaseRepository {
  constructor() {
    super('line_worker_assignments');
  }

  async getByDate(tenantId, date) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('date', date);
    if (error) throw error;
    return data || [];
  }

  async getByLineAndDate(tenantId, lineId, date) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('line_id', lineId)
      .eq('date', date);
    if (error) throw error;
    return data || [];
  }
}

export const lineAssignmentRepository = new LineAssignmentRepository();
