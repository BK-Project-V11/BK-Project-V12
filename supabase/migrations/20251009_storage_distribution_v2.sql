-- Drop existing policies first
DO $$ 
BEGIN
    -- Drop policies if they exist
    DROP POLICY IF EXISTS "Admin dapat melihat semua penyesuaian stok" ON stock_adjustments;
    DROP POLICY IF EXISTS "Admin dapat menambah penyesuaian stok" ON stock_adjustments;
    DROP POLICY IF EXISTS "Admin dapat melihat semua distribusi" ON product_distributions;
    DROP POLICY IF EXISTS "Kasir hanya dapat melihat distribusinya sendiri" ON product_distributions;
    DROP POLICY IF EXISTS "Admin dapat membuat distribusi" ON product_distributions;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- Drop existing triggers first
DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS trigger_update_stock_on_adjustment ON stock_adjustments;
    DROP TRIGGER IF EXISTS trigger_validate_distribution ON product_distributions;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- Drop functions with CASCADE
DROP FUNCTION IF EXISTS update_product_stock_on_adjustment() CASCADE;
DROP FUNCTION IF EXISTS validate_product_distribution() CASCADE;

-- Drop existing tables
DROP TABLE IF EXISTS stock_adjustments CASCADE;
DROP TABLE IF EXISTS product_distributions CASCADE;

-- Tambah kolom baru di tabel products
DO $$ 
BEGIN
    ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS storage_stock INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS distribution_stock INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS returned_stock INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS rejected_stock INTEGER DEFAULT 0;
EXCEPTION
    WHEN duplicate_column THEN 
        NULL;
END $$;

-- Update data yang ada: set storage_stock sama dengan stock yang ada
UPDATE products SET storage_stock = stock WHERE storage_stock = 0;

-- Buat tabel product_distributions
CREATE TABLE product_distributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL,
    cashier_id UUID REFERENCES auth.users(id) NOT NULL,
    distributed_by UUID REFERENCES auth.users(id) NOT NULL,
    status VARCHAR(20) CHECK (
        status IN ('pending', 'distributed', 'completed')
    ) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buat tabel stock_adjustments
CREATE TABLE stock_adjustments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) NOT NULL,
    adjustment_type VARCHAR(20) CHECK (
        adjustment_type IN (
            'production',
            'distribution',
            'return',
            'reject',
            'disposal'
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE product_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Create functions
CREATE OR REPLACE FUNCTION update_product_stock_on_adjustment()
RETURNS TRIGGER AS $$
BEGIN
    CASE NEW.adjustment_type
        WHEN 'production' THEN
            UPDATE products
            SET storage_stock = storage_stock + NEW.quantity
            WHERE id = NEW.product_id;
            
        WHEN 'distribution' THEN
            UPDATE products
            SET storage_stock = storage_stock - NEW.quantity,
                distribution_stock = distribution_stock + NEW.quantity
            WHERE id = NEW.product_id;
            
        WHEN 'return' THEN
            UPDATE products
            SET distribution_stock = distribution_stock - NEW.quantity,
                returned_stock = returned_stock + NEW.quantity
            WHERE id = NEW.product_id;
            
        WHEN 'reject' THEN
            UPDATE products
            SET distribution_stock = distribution_stock - NEW.quantity,
                rejected_stock = rejected_stock + NEW.quantity
            WHERE id = NEW.product_id;
            
        WHEN 'disposal' THEN
            IF NEW.source_location = 'rejected' THEN
                UPDATE products
                SET rejected_stock = rejected_stock - NEW.quantity
                WHERE id = NEW.product_id;
            ELSE
                UPDATE products
                SET returned_stock = returned_stock - NEW.quantity
                WHERE id = NEW.product_id;
            END IF;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_product_distribution()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT storage_stock FROM products WHERE id = NEW.product_id) < NEW.quantity THEN
        RAISE EXCEPTION 'Stok di storage tidak mencukupi';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = NEW.distributed_by 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RAISE EXCEPTION 'Hanya admin yang dapat mendistribusikan produk';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = NEW.cashier_id 
        AND raw_user_meta_data->>'role' = 'cashier'
    ) THEN
        RAISE EXCEPTION 'Produk hanya dapat didistribusikan ke kasir';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_stock_on_adjustment
    AFTER INSERT ON stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_on_adjustment();

CREATE TRIGGER trigger_validate_distribution
    BEFORE INSERT ON product_distributions
    FOR EACH ROW
    EXECUTE FUNCTION validate_product_distribution();

-- Create policies
CREATE POLICY "Admin dapat melihat semua penyesuaian stok"
    ON stock_adjustments FOR SELECT
    TO authenticated
    USING (auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
    ));

CREATE POLICY "Admin dapat menambah penyesuaian stok"
    ON stock_adjustments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
    ));

-- Drop semua policy yang ada
DROP POLICY IF EXISTS "Admin dapat melihat semua distribusi" ON product_distributions;
DROP POLICY IF EXISTS "Kasir hanya dapat melihat distribusinya sendiri" ON product_distributions;

-- Buat policy baru yang lebih sederhana
CREATE POLICY "Melihat distribusi berdasarkan role"
    ON product_distributions FOR SELECT
    TO authenticated
    USING (
        (
            -- Admin dapat melihat semua
            EXISTS (
                SELECT 1 FROM auth.users
                WHERE id = auth.uid()
                AND raw_user_meta_data->>'role' = 'admin'
            )
        ) OR (
            -- Kasir hanya melihat miliknya
            auth.uid() = cashier_id
        )
    );

CREATE POLICY "Admin dapat membuat distribusi"
    ON product_distributions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
    ));

-- Function untuk admin melihat semua distribusi
CREATE OR REPLACE FUNCTION get_admin_distributions(user_id UUID)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    quantity INTEGER,
    cashier_id UUID,
    distributed_by UUID,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    product_name TEXT,
    product_sku TEXT
) AS $$
BEGIN
  -- Verifikasi role admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = user_id 
    AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  RETURN QUERY
    SELECT 
      pd.id,
      pd.product_id,
      pd.quantity,
      pd.cashier_id,
      pd.distributed_by,
      pd.status,
      pd.created_at,
      pd.updated_at,
      p.name as product_name,
      p.sku as product_sku
    FROM product_distributions pd
    JOIN products p ON p.id = pd.product_id
    ORDER BY pd.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function untuk kasir melihat distribusinya sendiri
CREATE OR REPLACE FUNCTION get_cashier_distributions(user_id UUID)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    quantity INTEGER,
    cashier_id UUID,
    distributed_by UUID,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    product_name TEXT,
    product_sku TEXT
) AS $$
BEGIN
  -- Verifikasi role kasir
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = user_id 
    AND raw_user_meta_data->>'role' = 'cashier'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Cashier role required';
  END IF;

  RETURN QUERY
    SELECT 
      pd.id,
      pd.product_id,
      pd.quantity,
      pd.cashier_id,
      pd.distributed_by,
      pd.status,
      pd.created_at,
      pd.updated_at,
      p.name as product_name,
      p.sku as product_sku
    FROM product_distributions pd
    JOIN products p ON p.id = pd.product_id
    WHERE pd.cashier_id = user_id
    ORDER BY pd.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view untuk memudahkan akses data distribusi
CREATE OR REPLACE VIEW distribution_view AS
SELECT 
    pd.id,
    pd.quantity,
    pd.status,
    pd.created_at,
    pd.updated_at,
    pd.cashier_id,
    pd.distributed_by,
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    p.storage_stock,
    p.distribution_stock
FROM product_distributions pd
JOIN products p ON p.id = pd.product_id;

-- Grant permissions pada view
GRANT SELECT ON distribution_view TO authenticated;

-- Set RLS pada view
ALTER VIEW distribution_view SECURITY INVOKER;