require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'retail_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function addAuditLogs() {
    const client = await pool.connect();
    
    try {
        console.log('📦 Adding audit logs schema...');
        
        // Read and execute audit logs schema file
        const schemaPath = path.join(__dirname, '../config/audit-logs-schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        await client.query('BEGIN');
        await client.query(schemaSQL);
        await client.query('COMMIT');
        
        console.log('✅ Audit logs schema added successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error adding audit logs schema:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addAuditLogs().catch(console.error);

