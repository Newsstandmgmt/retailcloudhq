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

const LOG_CREDENTIALS = process.env.LOG_DB_CREDENTIALS === 'true';

const buildPoolConfig = (overrideUrl) => {
    if (overrideUrl || process.env.DATABASE_URL) {
        const ssl =
            process.env.DB_SSL === 'false'
                ? false
                : {
                      rejectUnauthorized: process.env.DB_SSL_STRICT === 'true',
                  };

        const connectionString = overrideUrl || process.env.DATABASE_URL;

        return {
            connectionString,
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

const logConfig = (config) => {
    if (!LOG_CREDENTIALS) {
        console.log('ℹ️  LOG_DB_CREDENTIALS not set to true; skipping DB config log');
        return;
    }

    if (config.connectionString) {
        console.log('🔐 Using connection string:', config.connectionString.replace(/:(.*?)@/, ':****@'));
    } else {
        console.log('🔐 DB config:', {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            ssl: config.ssl,
        });
    }
};

const primaryConfig = buildPoolConfig();
logConfig(primaryConfig);
let pool = new Pool(primaryConfig);

async function initDatabase() {
    let client;
    
    try {
        client = await pool.connect();
        console.log('✅ Connected using primary database configuration');
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
        console.error('❌ Error initializing database with primary configuration:', error);
        await pool.end().catch(() => {});

        if (process.env.DATABASE_PUBLIC_URL) {
            console.log('🔄 Retrying database initialization using DATABASE_PUBLIC_URL...');
            const publicConfig = buildPoolConfig(process.env.DATABASE_PUBLIC_URL);
            logConfig(publicConfig);
            pool = new Pool(publicConfig);

            try {
                client = await pool.connect();
                console.log('✅ Connected using public database configuration');

                const schemaPath = path.join(__dirname, '../config/database.sql');
                const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

                await client.query('BEGIN');
                await client.query(schemaSQL);
                await client.query('COMMIT');

                console.log('✅ Database schema created successfully!');

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

                console.log('🎉 Database initialization complete using public URL!');
                return;
            } catch (publicError) {
                console.error('❌ Error initializing database with public configuration:', publicError);
                throw publicError;
            } finally {
                if (client) client.release();
                await pool.end().catch(() => {});
            }
        }

        throw error;
    } finally {
        if (client) client.release();
        await pool.end().catch(() => {});
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

