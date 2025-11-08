/**
 * Database Verification Script
 * 
 * This script verifies that your PostgreSQL database is properly set up
 * for RetailCloudHQ.
 * 
 * Usage: node scripts/verify-db.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'retail_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

const checks = {
    connection: false,
    database: false,
    tables: false,
    indexes: false,
    triggers: false,
    superAdmin: false,
    envConfig: false
};

let errors = [];
let warnings = [];

async function verifyConnection() {
    try {
        const result = await pool.query('SELECT NOW(), version()');
        checks.connection = true;
        console.log('✅ Database connection successful');
        console.log(`   PostgreSQL version: ${result.rows[0].version.split(',')[0]}`);
        console.log(`   Server time: ${result.rows[0].now}`);
        return true;
    } catch (error) {
        errors.push(`Connection failed: ${error.message}`);
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

async function verifyDatabase() {
    try {
        const result = await pool.query(
            "SELECT datname FROM pg_database WHERE datname = $1",
            [process.env.DB_NAME || 'retail_management']
        );
        if (result.rows.length > 0) {
            checks.database = true;
            console.log(`✅ Database '${process.env.DB_NAME || 'retail_management'}' exists`);
            return true;
        } else {
            errors.push(`Database '${process.env.DB_NAME}' does not exist`);
            console.error(`❌ Database '${process.env.DB_NAME}' does not exist`);
            return false;
        }
    } catch (error) {
        errors.push(`Database check failed: ${error.message}`);
        console.error('❌ Database check failed:', error.message);
        return false;
    }
}

async function verifyTables() {
    try {
        const requiredTables = [
            'users',
            'stores',
            'daily_revenue',
            'daily_lottery',
            'daily_cash_flow',
            'daily_cogs',
            'monthly_utilities',
            'monthly_operating_expenses',
            'license_fees',
            'customers',
            'suppliers',
            'user_store_assignments'
        ];
        
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        const existingTables = result.rows.map(row => row.table_name);
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));
        
        if (missingTables.length === 0) {
            checks.tables = true;
            console.log(`✅ All ${requiredTables.length} required tables exist`);
            console.log(`   Tables: ${existingTables.join(', ')}`);
            return true;
        } else {
            errors.push(`Missing tables: ${missingTables.join(', ')}`);
            console.error(`❌ Missing ${missingTables.length} table(s): ${missingTables.join(', ')}`);
            console.log(`   Found ${existingTables.length} table(s): ${existingTables.join(', ')}`);
            return false;
        }
    } catch (error) {
        errors.push(`Table verification failed: ${error.message}`);
        console.error('❌ Table verification failed:', error.message);
        return false;
    }
}

async function verifyIndexes() {
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as count 
            FROM pg_indexes 
            WHERE schemaname = 'public'
        `);
        
        const indexCount = parseInt(result.rows[0].count);
        if (indexCount > 0) {
            checks.indexes = true;
            console.log(`✅ Indexes created (${indexCount} found)`);
            return true;
        } else {
            warnings.push('No indexes found (this may be okay if tables are empty)');
            console.warn('⚠️  No indexes found');
            return false;
        }
    } catch (error) {
        warnings.push(`Index check failed: ${error.message}`);
        console.warn('⚠️  Index check failed:', error.message);
        return false;
    }
}

async function verifyTriggers() {
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as count 
            FROM pg_trigger 
            WHERE tgname LIKE 'update_%_updated_at'
        `);
        
        const triggerCount = parseInt(result.rows[0].count);
        if (triggerCount >= 10) {
            checks.triggers = true;
            console.log(`✅ Update triggers created (${triggerCount} found)`);
            return true;
        } else {
            warnings.push(`Only ${triggerCount} triggers found (expected at least 10)`);
            console.warn(`⚠️  Only ${triggerCount} triggers found`);
            return false;
        }
    } catch (error) {
        warnings.push(`Trigger check failed: ${error.message}`);
        console.warn('⚠️  Trigger check failed:', error.message);
        return false;
    }
}

async function verifySuperAdmin() {
    try {
        if (!process.env.SUPER_ADMIN_EMAIL) {
            warnings.push('SUPER_ADMIN_EMAIL not set in .env');
            console.warn('⚠️  SUPER_ADMIN_EMAIL not configured in .env');
            return false;
        }
        
        const result = await pool.query(
            'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE email = $1',
            [process.env.SUPER_ADMIN_EMAIL]
        );
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user.role === 'super_admin' && user.is_active) {
                checks.superAdmin = true;
                console.log(`✅ Super admin user exists: ${user.email}`);
                console.log(`   Name: ${user.first_name} ${user.last_name}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Active: ${user.is_active}`);
                
                // Test password if provided
                if (process.env.SUPER_ADMIN_PASSWORD) {
                    const userWithPassword = await pool.query(
                        'SELECT password_hash FROM users WHERE email = $1',
                        [process.env.SUPER_ADMIN_EMAIL]
                    );
                    if (userWithPassword.rows.length > 0) {
                        const isValid = await bcrypt.compare(
                            process.env.SUPER_ADMIN_PASSWORD,
                            userWithPassword.rows[0].password_hash
                        );
                        if (isValid) {
                            console.log('✅ Super admin password is correct');
                        } else {
                            warnings.push('Super admin password does not match');
                            console.warn('⚠️  Super admin password does not match .env');
                        }
                    }
                }
                return true;
            } else {
                errors.push(`User exists but role is '${user.role}' or is inactive`);
                console.error(`❌ User exists but role is '${user.role}' or is inactive`);
                return false;
            }
        } else {
            errors.push(`Super admin user '${process.env.SUPER_ADMIN_EMAIL}' not found`);
            console.error(`❌ Super admin user '${process.env.SUPER_ADMIN_EMAIL}' not found`);
            console.log('   Run: node scripts/init-db.js to create the user');
            return false;
        }
    } catch (error) {
        errors.push(`Super admin check failed: ${error.message}`);
        console.error('❌ Super admin check failed:', error.message);
        return false;
    }
}

function verifyEnvConfig() {
    const required = ['DB_HOST', 'DB_NAME', 'DB_USER'];
    const optional = ['DB_PASSWORD', 'JWT_SECRET', 'PORT'];
    
    let allRequired = true;
    required.forEach(key => {
        if (!process.env[key]) {
            errors.push(`Required environment variable ${key} is not set`);
            allRequired = false;
        }
    });
    
    if (allRequired) {
        checks.envConfig = true;
        console.log('✅ Environment configuration complete');
        console.log(`   DB_HOST: ${process.env.DB_HOST}`);
        console.log(`   DB_NAME: ${process.env.DB_NAME}`);
        console.log(`   DB_USER: ${process.env.DB_USER}`);
        console.log(`   DB_PORT: ${process.env.DB_PORT || 5432}`);
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('your-secret')) {
            warnings.push('JWT_SECRET should be changed from default value');
            console.warn('⚠️  JWT_SECRET should be changed in production');
        }
        return true;
    } else {
        console.error('❌ Missing required environment variables');
        return false;
    }
}

async function runVerification() {
    console.log('🔍 Verifying RetailCloudHQ Database Setup...\n');
    console.log('=' .repeat(60));
    
    // Check environment configuration first
    verifyEnvConfig();
    console.log('');
    
    // Check connection
    const connected = await verifyConnection();
    if (!connected) {
        console.log('\n❌ Cannot proceed - database connection failed');
        console.log('\nTroubleshooting:');
        console.log('1. Make sure PostgreSQL is running: pg_isready');
        console.log('2. Check your .env file has correct DB credentials');
        console.log('3. Verify database exists: psql -l | grep retail_management');
        await pool.end();
        process.exit(1);
    }
    console.log('');
    
    // Verify database
    await verifyDatabase();
    console.log('');
    
    // Verify tables
    await verifyTables();
    console.log('');
    
    // Verify indexes
    await verifyIndexes();
    console.log('');
    
    // Verify triggers
    await verifyTriggers();
    console.log('');
    
    // Verify super admin
    await verifySuperAdmin();
    console.log('');
    
    // Summary
    console.log('=' .repeat(60));
    console.log('📊 Verification Summary\n');
    
    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter(v => v).length;
    
    console.log(`✅ Passed: ${passedChecks}/${totalChecks} checks`);
    
    if (warnings.length > 0) {
        console.log(`\n⚠️  Warnings (${warnings.length}):`);
        warnings.forEach(w => console.log(`   - ${w}`));
    }
    
    if (errors.length > 0) {
        console.log(`\n❌ Errors (${errors.length}):`);
        errors.forEach(e => console.log(`   - ${e}`));
        console.log('\n💡 Fix the errors above and run this script again');
        await pool.end();
        process.exit(1);
    }
    
    if (passedChecks === totalChecks) {
        console.log('\n🎉 All checks passed! Your database is fully set up and ready to use.');
        console.log('\nNext steps:');
        console.log('1. Start the server: npm run dev');
        console.log('2. Test login: curl -X POST http://localhost:3000/api/auth/login \\');
        console.log('     -H "Content-Type: application/json" \\');
        console.log(`     -d '{"email":"${process.env.SUPER_ADMIN_EMAIL}","password":"${process.env.SUPER_ADMIN_PASSWORD || 'your_password'}"}'`);
    } else {
        console.log('\n⚠️  Some checks failed. Review warnings above.');
    }
    
    await pool.end();
    process.exit(errors.length > 0 ? 1 : 0);
}

// Run verification
runVerification().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

