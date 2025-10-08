import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddcmuhwpanbatixdfpla.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkY211aHdwYW5iYXRpeGRmcGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3OTM5OTAsImV4cCI6MjA3NDM2OTk5MH0.LhFjSYP919XvFo2MzM7V4QquGOq3UhNuo6qfGy_fDCQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('Testing connection...');
    
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('products')
      .select('count(*)');

    if (testError) {
      console.error('Connection test failed:', testError);
      return;
    }
    
    console.log('Connection successful!');

    // Add new columns to products table
    console.log('Adding new columns to products table...');
    const alterTableSQL = `
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS storage_stock INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS distribution_stock INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS returned_stock INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rejected_stock INTEGER DEFAULT 0;
    `;

    const { error: alterError } = await supabase.rpc('exec_sql', { 
      sql: alterTableSQL 
    });

    if (alterError) {
      console.error('Error adding columns:', alterError);
      return;
    }

    // Create stock_adjustments table
    console.log('Creating stock_adjustments table...');
    const stockAdjustmentsSQL = `
      DROP TABLE IF EXISTS stock_adjustments;
      CREATE TABLE stock_adjustments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        product_id UUID REFERENCES products(id) NOT NULL,
        adjustment_type VARCHAR(20) CHECK (
          adjustment_type IN (
            'production',
            'distribution',
            'return',
            'reject'
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
    `;

    const { error: stockError } = await supabase.rpc('exec_sql', { 
      sql: stockAdjustmentsSQL 
    });

    if (stockError) {
      console.error('Error creating stock_adjustments table:', stockError);
      return;
    }

    // Create product_distributions table
    console.log('Creating product_distributions table...');
    const distributionsSQL = `
      CREATE TABLE IF NOT EXISTS product_distributions (
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
    `;

    const { error: distError } = await supabase.rpc('exec_sql', { 
      sql: distributionsSQL 
    });

    if (distError) {
      console.error('Error creating product_distributions table:', distError);
      return;
    }

    console.log('Migration completed successfully!');
    
    // Verify the changes
    const { data: verifyData, error: verifyError } = await supabase
      .from('products')
      .select('storage_stock, distribution_stock, returned_stock, rejected_stock')
      .limit(1);

    if (verifyError) {
      console.error('Error verifying changes:', verifyError);
      return;
    }

    console.log('New columns verified:', verifyData);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

applyMigration();