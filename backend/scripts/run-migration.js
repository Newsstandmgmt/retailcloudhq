// Script to run SQL migration files
const fs = require('fs');
const path = require('path');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { query } = require('../config/database');

async function runMigration() {
    const args = process.argv.slice(2);
    const files = args.length > 0 ? args : ['config/state-lottery-config-schema.sql'];

    for (const relativePath of files) {
        const migrationFile = path.join(__dirname, '..', relativePath);

        if (!fs.existsSync(migrationFile)) {
            console.error('❌ Migration file not found:', migrationFile);
            continue;
        }

        console.log('\n============================================');
        console.log('📄 Reading migration file:', migrationFile);
        console.log('🔌 Connecting as:', process.env.DB_USER || 'postgres');
        console.log('📊 Database:', process.env.DB_NAME || 'retail_management');

        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log('🚀 Running migration...');
        try {
            await query(sql);
            console.log('✅ Migration completed successfully!');
        } catch (error) {
            if (
                error.message.includes('already exists') ||
                error.message.includes('duplicate') ||
                error.code === '42P07' ||
                error.code === '42710'
            ) {
                console.log('⚠️  Migration already applied (object exists)');
            } else {
                console.error('❌ Migration failed:', error.message);
                console.error('Error code:', error.code);
                process.exit(1);
            }
        }
    }
}

runMigration();

