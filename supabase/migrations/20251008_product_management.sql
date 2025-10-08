-- Tabel untuk pencatatan produksi produk
CREATE TABLE IF NOT EXISTS production_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) NOT NULL,
    batch_number VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    production_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel untuk alokasi produk ke kasir
CREATE TABLE IF NOT EXISTS product_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) NOT NULL,
    cashier_id UUID REFERENCES users(id) NOT NULL,
    quantity INTEGER NOT NULL,
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) CHECK (status IN ('allocated', 'returned', 'sold')) DEFAULT 'allocated',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel untuk pengembalian produk dari kasir
CREATE TABLE IF NOT EXISTS product_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    allocation_id UUID REFERENCES product_allocations(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    cashier_id UUID REFERENCES users(id) NOT NULL,
    quantity INTEGER NOT NULL,
    return_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    condition VARCHAR(20) CHECK (condition IN ('good', 'damaged', 'expired')),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Menambahkan kolom untuk tracking stok per kasir di tabel products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS total_produced INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_allocated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_returned INTEGER DEFAULT 0;

-- Fungsi untuk update stok otomatis saat ada produksi baru
CREATE OR REPLACE FUNCTION update_product_stock_on_production()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET total_produced = total_produced + NEW.quantity
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fungsi untuk update stok otomatis saat ada alokasi
CREATE OR REPLACE FUNCTION update_product_stock_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET total_allocated = total_allocated + NEW.quantity
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fungsi untuk update stok otomatis saat ada pengembalian
CREATE OR REPLACE FUNCTION update_product_stock_on_return()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET total_returned = total_returned + NEW.quantity
    WHERE id = NEW.product_id;
    
    -- Update status alokasi
    UPDATE product_allocations
    SET status = 'returned'
    WHERE id = NEW.allocation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk produksi
CREATE TRIGGER trigger_update_stock_on_production
AFTER INSERT ON production_batches
FOR EACH ROW
EXECUTE FUNCTION update_product_stock_on_production();

-- Trigger untuk alokasi
CREATE TRIGGER trigger_update_stock_on_allocation
AFTER INSERT ON product_allocations
FOR EACH ROW
EXECUTE FUNCTION update_product_stock_on_allocation();

-- Trigger untuk pengembalian
CREATE TRIGGER trigger_update_stock_on_return
AFTER INSERT ON product_returns
FOR EACH ROW
EXECUTE FUNCTION update_product_stock_on_return();

-- View untuk melihat stok per kasir
CREATE OR REPLACE VIEW cashier_product_stock AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    u.id as cashier_id,
    u.full_name as cashier_name,
    COALESCE(SUM(CASE WHEN pa.status = 'allocated' THEN pa.quantity ELSE 0 END), 0) as allocated_stock,
    COALESCE(SUM(CASE WHEN pa.status = 'returned' THEN pa.quantity ELSE 0 END), 0) as returned_stock,
    COALESCE(SUM(CASE WHEN pa.status = 'sold' THEN pa.quantity ELSE 0 END), 0) as sold_stock
FROM 
    products p
    CROSS JOIN users u
    LEFT JOIN product_allocations pa ON pa.product_id = p.id AND pa.cashier_id = u.id
WHERE 
    u.role = 'cashier'
GROUP BY 
    p.id, p.name, u.id, u.full_name;

-- RLS Policies
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_returns ENABLE ROW LEVEL SECURITY;

-- Policies untuk production_batches
CREATE POLICY "Admin dapat melihat semua batch produksi" ON production_batches
FOR SELECT TO authenticated
USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Admin dapat menambah batch produksi" ON production_batches
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Policies untuk product_allocations
CREATE POLICY "Admin dapat melihat semua alokasi" ON product_allocations
FOR SELECT TO authenticated
USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Kasir hanya dapat melihat alokasinya" ON product_allocations
FOR SELECT TO authenticated
USING (cashier_id = auth.uid());

CREATE POLICY "Admin dapat membuat alokasi" ON product_allocations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Policies untuk product_returns
CREATE POLICY "Admin dapat melihat semua pengembalian" ON product_returns
FOR SELECT TO authenticated
USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Kasir hanya dapat melihat pengembaliannya" ON product_returns
FOR SELECT TO authenticated
USING (cashier_id = auth.uid());

CREATE POLICY "Admin dan kasir dapat membuat pengembalian" ON product_returns
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    OR
    auth.uid() = cashier_id
);