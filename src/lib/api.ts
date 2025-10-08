import { supabase } from './supabase';

// ... (existing code) ...

export type StockAdjustmentType = 'production' | 'distribution' | 'return' | 'reject' | 'disposal';
export type LocationType = 'production' | 'storage' | 'cashier' | 'disposal';
export type ConditionType = 'good' | 'damaged' | 'expired' | 'rejected';

interface StockAdjustment {
  product_id: string;
  adjustment_type: StockAdjustmentType;
  quantity: number;
  source_location: LocationType;
  target_location: LocationType;
  condition: ConditionType;
  notes?: string;
}

interface ProductDistribution {
  product_id: string;
  quantity: number;
  cashier_id: string;
}

export async function createStockAdjustment(adjustment: StockAdjustment) {
  const { data, error } = await supabase
    .from('stock_adjustments')
    .insert([adjustment])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createDistribution(distribution: ProductDistribution) {
  const { data, error } = await supabase
    .from('product_distributions')
    .insert([distribution])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProductStock(productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('storage_stock, distribution_stock, returned_stock, rejected_stock')
    .eq('id', productId)
    .single();

  if (error) throw error;
  return data;
}

export async function getDistributions(isCashier: boolean = false) {
  const query = supabase
    .from('product_distributions')
    .select(`
      *,
      product:products(name),
      cashier:cashier_id(email)
    `);

  if (isCashier) {
    const { data: { user } } = await supabase.auth.getUser();
    query.eq('cashier_id', user?.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getStockAdjustments() {
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select(`
      *,
      product:products(name),
      creator:created_by(email)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
