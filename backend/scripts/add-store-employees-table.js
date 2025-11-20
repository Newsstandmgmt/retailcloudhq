const { query } = require('../config/database');

async function addStoreEmployeesTable() {
  try {
    console.log('Creating store_employees table...');
    
    // Create store_employees table
    await query(`
      CREATE TABLE IF NOT EXISTS store_employees (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by UUID REFERENCES users(id),
        
        UNIQUE(store_id, employee_id)
      );
    `);
    
    // Create indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_store_employees_store ON store_employees(store_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_store_employees_employee ON store_employees(employee_id);
    `);
    
    console.log('✅ store_employees table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating store_employees table:', error);
    process.exit(1);
  }
}

addStoreEmployeesTable();

