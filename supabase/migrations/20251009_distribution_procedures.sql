-- Function untuk admin melihat semua distribusi
CREATE OR REPLACE FUNCTION get_admin_distributions(user_id UUID)
RETURNS SETOF product_distributions AS $$
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
    SELECT * FROM product_distributions
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function untuk kasir melihat distribusinya sendiri
CREATE OR REPLACE FUNCTION get_cashier_distributions(user_id UUID)
RETURNS SETOF product_distributions AS $$
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
    SELECT * FROM product_distributions
    WHERE cashier_id = user_id
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_admin_distributions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cashier_distributions(UUID) TO authenticated;

-- Create policy untuk mengakses functions
CREATE POLICY "Allow authenticated users to execute get_admin_distributions"
  ON product_distributions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to execute get_cashier_distributions"
  ON product_distributions
  FOR SELECT
  TO authenticated
  USING (true);