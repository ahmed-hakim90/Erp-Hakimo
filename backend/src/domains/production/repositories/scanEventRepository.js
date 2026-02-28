import { BaseRepository } from './baseRepository.js';
import { supabaseAdmin } from '../../../config/supabaseAdmin.js';

class ScanEventRepository extends BaseRepository {
  constructor() {
    super('scan_events');
  }

  async getByWorkOrder(tenantId, workOrderId) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('work_order_id', workOrderId)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getByWorkOrderAndSerial(tenantId, workOrderId, serialBarcode) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('work_order_id', workOrderId)
      .eq('serial_barcode', serialBarcode)
      .order('timestamp', { ascending: true })
      .limit(100);
    if (error) throw error;
    return data || [];
  }
}

export const scanEventRepository = new ScanEventRepository();
import { BaseRepository } from './baseRepository.js';
import { supabaseAdmin } from '../../../config/supabaseAdmin.js';

class ScanEventRepository extends BaseRepository {
  constructor() {
    super('scan_events');
  }

  async getByWorkOrder(tenantId, workOrderId) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('work_order_id', workOrderId)
      .order('event_ts', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getByWorkOrderAndSerial(tenantId, workOrderId, serialBarcode) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('work_order_id', workOrderId)
      .eq('serial_barcode', serialBarcode)
      .order('event_ts', { ascending: true })
      .limit(100);
    if (error) throw error;
    return data || [];
  }
}

export const scanEventRepository = new ScanEventRepository();
