import { supabase } from './lib/supabase';

async function testAndApplyMigration() {
  try {
    console.log('Testing connection to Supabase...');
    
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('products')
      .select('count(*)');

    if (testError) throw testError;
    
    console.log('Connection successful!');
    
    // Read migration file
    const migrationSQL = `
    -- Tambah kolom baru di tabel products
    ALTER TABLE products ADD COLUMN IF NOT EXISTS storage_stock INTEGER DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS distribution_stock INTEGER DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS returned_stock INTEGER DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS rejected_stock INTEGER DEFAULT 0;

    -- Update trigger function
    CREATE OR REPLACE FUNCTION update_product_stock_on_adjustment()
    RETURNS TRIGGER AS $$
    BEGIN
        CASE NEW.adjustment_type
            WHEN 'production' THEN
                -- Tambah ke storage_stock
                UPDATE products
                SET storage_stock = storage_stock + NEW.quantity
                WHERE id = NEW.product_id;
                
            WHEN 'distribution' THEN
                -- Kurangi storage_stock, tambah distribution_stock
                UPDATE products
                SET storage_stock = storage_stock - NEW.quantity,
                    distribution_stock = distribution_stock + NEW.quantity
                WHERE id = NEW.product_id;
                
            WHEN 'return' THEN
                -- Kurangi distribution_stock, tambah returned_stock
                UPDATE products
                SET distribution_stock = distribution_stock - NEW.quantity,
                    returned_stock = returned_stock + NEW.quantity
                WHERE id = NEW.product_id;
                
            WHEN 'reject' THEN
                -- Kurangi distribution_stock, tambah rejected_stock
                UPDATE products
                SET distribution_stock = distribution_stock - NEW.quantity,
                    rejected_stock = rejected_stock + NEW.quantity
                WHERE id = NEW.product_id;
        END CASE;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Recreate stock_adjustments table
    DROP TABLE IF EXISTS stock_adjustments;
    CREATE TABLE IF NOT EXISTS stock_adjustments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        product_id UUID REFERENCES products(id) NOT NULL,
        adjustment_type VARCHAR(20) CHECK (
            adjustment_type IN (
                'production',     -- Produksi baru ke storage
                'distribution',   -- Distribusi dari storage ke kasir
                'return',        -- Retur dari kasir ke storage
                'reject'         -- Reject dari kasir ke storage
            )
        ) NOT NULL,
        quantity INTEGER NOT NULL,
        source_location VARCHAR(20) CHECK (
            source_location IN ('production', 'storage', 'cashier')
        ) NOT NULL,
        target_location VARCHAR(20) CHECK (
            target_location IN ('storage', 'cashier', 'disposal')
        ) NOT NULL,
        condition VARCHAR(20) CHECK (
            condition IN ('good', 'damaged', 'expired', 'rejected')
        ) NOT NULL,
        notes TEXT,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create distributions table
    CREATE TABLE IF NOT EXISTS product_distributions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        product_id UUID REFERENCES products(id) NOT NULL,
        quantity INTEGER NOT NULL,
        cashier_id UUID REFERENCES auth.users(id) NOT NULL,
        distributed_by UUID REFERENCES auth.users(id) NOT NULL,
        status VARCHAR(20) CHECK (
            status IN ('pending', 'distributed', 'completed')
        ) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE product_distributions ENABLE ROW LEVEL SECURITY;

    -- Stock adjustments policies
    DROP POLICY IF EXISTS "Admin dapat melihat semua penyesuaian stok" ON stock_adjustments;
    CREATE POLICY "Admin dapat melihat semua penyesuaian stok" ON stock_adjustments
        FOR SELECT TO authenticated
        USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

    DROP POLICY IF EXISTS "Admin dapat menambah penyesuaian stok" ON stock_adjustments;
    CREATE POLICY "Admin dapat menambah penyesuaian stok" ON stock_adjustments
        FOR INSERT TO authenticated
        WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

    -- Distribution policies
    DROP POLICY IF EXISTS "Admin dapat melihat semua distribusi" ON product_distributions;
    CREATE POLICY "Admin dapat melihat semua distribusi" ON product_distributions
        FOR SELECT TO authenticated
        USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

    DROP POLICY IF EXISTS "Kasir hanya dapat melihat distribusinya sendiri" ON product_distributions;
    CREATE POLICY "Kasir hanya dapat melihat distribusinya sendiri" ON product_distributions
        FOR SELECT TO authenticated
        USING (
            auth.uid() = cashier_id AND 
            auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'cashier')
        );

    DROP POLICY IF EXISTS "Admin dapat membuat distribusi" ON product_distributions;
    CREATE POLICY "Admin dapat membuat distribusi" ON product_distributions
        FOR INSERT TO authenticated
        WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));
    `;

    // Apply migration
    console.log('Applying migration...');
    const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (migrationError) throw migrationError;
    
    console.log('Migration applied successfully!');

    // Verify new columns
    const { data: columnsData, error: columnsError } = await supabase
      .from('products')
      .select('storage_stock, distribution_stock, returned_stock, rejected_stock')
      .limit(1);

    if (columnsError) throw columnsError;
    
    console.log('New columns verified:', columnsData);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAndApplyMigration();