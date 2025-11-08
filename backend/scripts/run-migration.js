// Script to run SQL migration files
const fs = require('fs');
const path = require('path');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { query } = require('../config/database');

async function runMigration() {
    const migrationFile = path.join(__dirname, '../config/state-lottery-config-schema.sql');
    
    console.log('📄 Reading migration file:', migrationFile);
    console.log('🔌 Connecting as:', process.env.DB_USER || 'postgres');
    console.log('📊 Database:', process.env.DB_NAME || 'retail_management');
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('🚀 Running migration...');
    try {
        // Execute the entire SQL file as one transaction
        // PostgreSQL will handle multi-statement execution properly
        await query(sql);
        
        console.log('✅ Migration completed successfully!');
        console.log('✅ Created state_lottery_configs table');
        console.log('✅ Inserted default PA Lottery configuration');
        process.exit(0);
    } catch (error) {
        // Check if it's a "already exists" error
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.code === '42P07') { // duplicate_table
            console.log('⚠️  Migration already applied (table exists)');
            console.log('✅ Skipping migration');
            process.exit(0);
        } else {
            console.error('❌ Migration failed:', error.message);
            console.error('Error code:', error.code);
            process.exit(1);
        }
    }
}

runMigration();

