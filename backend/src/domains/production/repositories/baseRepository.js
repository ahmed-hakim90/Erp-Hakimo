import { supabaseAdmin } from '../../../config/supabaseAdmin.js';

export class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  query(tenantId) {
    return supabaseAdmin.from(this.tableName).select('*').eq('tenant_id', tenantId);
  }

  async getAll(tenantId) {
    const { data, error } = await this.query(tenantId);
    if (error) throw error;
    return data || [];
  }

  async getById(id, tenantId) {
    const { data, error } = await this.query(tenantId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async create(payload, tenantId) {
    const now = new Date().toISOString();
    const row = {
      ...payload,
      tenant_id: tenantId,
      created_at: payload.created_at || now,
      updated_at: payload.updated_at || now,
    };
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .insert(row)
      .select('id')
      .single();
    if (error) throw error;
    return data?.id ?? null;
  }

  async update(id, payload, tenantId) {
    const row = { ...payload, updated_at: new Date().toISOString() };
    delete row.id;
    delete row.tenant_id;
    const { error } = await supabaseAdmin
      .from(this.tableName)
      .update(row)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async remove(id, tenantId) {
    const { error } = await supabaseAdmin
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }
}
