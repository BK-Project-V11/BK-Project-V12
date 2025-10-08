-- Drop existing policies first
DROP POLICY IF EXISTS "Admin dapat melihat semua penyesuaian stok" ON stock_adjustments;
DROP POLICY IF EXISTS "Admin dapat menambah penyesuaian stok" ON stock_adjustments;
DROP POLICY IF EXISTS "Admin dapat melihat semua distribusi" ON product_distributions;
DROP POLICY IF EXISTS "Kasir hanya dapat melihat distribusinya sendiri" ON product_distributions;
DROP POLICY IF EXISTS "Admin dapat membuat distribusi" ON product_distributions;

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_update_stock_on_adjustment ON stock_adjustments;
DROP FUNCTION IF EXISTS update_product_stock_on_adjustment();

-- Drop existing tables
DROP TABLE IF EXISTS product_distributions;
DROP TABLE IF EXISTS stock_adjustments;

-- Tambah kolom baru di tabel products jika belum ada
ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS storage_stock INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS distribution_stock INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS returned_stock INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rejected_stock INTEGER DEFAULT 0;

-- Update data yang ada: set storage_stock sama dengan stock yang ada
UPDATE products SET storage_stock = stock WHERE storage_stock = 0;

-- Hapus dan buat ulang tabel stock_adjustments dengan fitur baru
DROP TABLE IF EXISTS stock_adjustments;

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) NOT NULL,
    adjustment_type VARCHAR(20) CHECK (
        adjustment_type IN (
            'production',     -- Produksi baru ke storage
            'distribution',   -- Distribusi dari storage ke kasir
            'return',        -- Retur dari kasir ke storage
            'reject',        -- Reject dari kasir ke storage
            'disposal'       -- Pembuangan barang reject/expired
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel untuk distribusi barang
CREATE TABLE IF NOT EXISTS product_distributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL,
    cashier_id UUID REFERENCES users(id) NOT NULL,
    distributed_by UUID REFERENCES users(id) NOT NULL,
    status VARCHAR(20) CHECK (
        status IN ('pending', 'distributed', 'completed')
    ) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies

-- Stock Adjustments Policies
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin dapat melihat semua penyesuaian stok" ON stock_adjustments
FOR SELECT TO authenticated
USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Admin dapat menambah penyesuaian stok" ON stock_adjustments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Product Distributions Policies
ALTER TABLE product_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin dapat melihat semua distribusi" ON product_distributions
FOR SELECT TO authenticated
USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Kasir hanya dapat melihat distribusinya sendiri" ON product_distributions
FOR SELECT TO authenticated
USING (auth.uid() = cashier_id);

CREATE POLICY "Admin dapat membuat distribusi" ON product_distributions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Functions dan Triggers

-- Function untuk mengupdate stok berdasarkan penyesuaian
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
            
        WHEN 'disposal' THEN
            -- Kurangi rejected_stock atau returned_stock
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

-- Trigger untuk penyesuaian stok
DROP TRIGGER IF EXISTS trigger_update_stock_on_adjustment ON stock_adjustments;
CREATE TRIGGER trigger_update_stock_on_adjustment
    AFTER INSERT ON stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_on_adjustment();

-- Function untuk memvalidasi distribusi
CREATE OR REPLACE FUNCTION validate_product_distribution()
RETURNS TRIGGER AS $$
BEGIN
    -- Cek apakah stok mencukupi di storage
    IF (SELECT storage_stock FROM products WHERE id = NEW.product_id) < NEW.quantity THEN
        RAISE EXCEPTION 'Stok di storage tidak mencukupi';
    END IF;
    
    -- Cek apakah pengguna adalah admin
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.distributed_by AND role = 'admin') THEN
        RAISE EXCEPTION 'Hanya admin yang dapat mendistribusikan produk';
    END IF;
    
    -- Cek apakah target adalah kasir
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.cashier_id AND role = 'cashier') THEN
        RAISE EXCEPTION 'Produk hanya dapat didistribusikan ke kasir';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk validasi distribusi
CREATE TRIGGER trigger_validate_distribution
    BEFORE INSERT ON product_distributions
    FOR EACH ROW
    EXECUTE FUNCTION validate_product_distribution();