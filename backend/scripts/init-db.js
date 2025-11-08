/**
 * Database Initialization Script
 * 
 * This script creates the database schema and sets up the initial super admin user.
 * Run this after creating your PostgreSQL database.
 * 
 * Usage: node scripts/init-db.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const buildPoolConfig = () => {
    if (process.env.DATABASE_URL) {
        const ssl =
            process.env.DB_SSL === 'false'
                ? false
                : {
                      rejectUnauthorized: process.env.DB_SSL_STRICT === 'true',
                  };

        return {
            connectionString: process.env.DATABASE_URL,
            ssl,
        };
    }

    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'retail_management',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

    if (process.env.DB_SSL === 'true') {
        config.ssl = {
            rejectUnauthorized: process.env.DB_SSL_STRICT === 'true',
        };
    }

    return config;
};

const pool = new Pool(buildPoolConfig());

async function initDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('📦 Initializing database schema...');
        
        // Read and execute SQL schema file
        const schemaPath = path.join(__dirname, '../config/database.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        await client.query('BEGIN');
        await client.query(schemaSQL);
        await client.query('COMMIT');
        
        console.log('✅ Database schema created successfully!');
        
        // Create super admin user if provided
        if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
            console.log('👤 Creating super admin user...');
            
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, saltRounds);
            
            await client.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (email) DO NOTHING`,
                [
                    process.env.SUPER_ADMIN_EMAIL,
                    password_hash,
                    process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
                    process.env.SUPER_ADMIN_LAST_NAME || 'Admin',
                    'super_admin'
                ]
            );
            
            console.log('✅ Super admin user created successfully!');
            console.log(`   Email: ${process.env.SUPER_ADMIN_EMAIL}`);
        } else {
            console.log('⚠️  No super admin credentials provided. You can create one manually later.');
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error initializing database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run initialization
initDatabase()
    .then(() => {
        console.log('🎉 Database initialization complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });

