import { BaseRepository } from './baseRepository.js';
import { supabaseAdmin } from '../../../config/supabaseAdmin.js';

class ProductMaterialRepository extends BaseRepository {
  constructor() {
    super('product_materials');
  }

  async getByProduct(tenantId, productId) {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('product_id', productId);
    if (error) throw error;
    return data || [];
  }
}

export const productMaterialRepository = new ProductMaterialRepository();
