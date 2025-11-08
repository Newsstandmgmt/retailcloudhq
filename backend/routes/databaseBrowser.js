const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// All routes require super admin
router.use(authenticate);
router.use(authorize('super_admin'));

// Get all database tables
router.get('/tables', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                table_name,
                table_schema
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        res.json({ tables: result.rows });
    } catch (error) {
        console.error('Get tables error:', error);
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
});

// Get table structure (columns)
router.get('/tables/:tableName/structure', async (req, res) => {
    try {
        const { tableName } = req.params;
        
        const result = await query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            ORDER BY ordinal_position
        `, [tableName]);
        
        res.json({ columns: result.rows });
    } catch (error) {
        console.error('Get table structure error:', error);
        res.status(500).json({ error: 'Failed to fetch table structure' });
    }
});

// Get table data with pagination
router.get('/tables/:tableName/data', async (req, res) => {
    try {
        const { tableName } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const sortBy = req.query.sort_by || 'created_at';
        const sortOrder = req.query.sort_order || 'DESC';
        
        // Validate table name to prevent SQL injection
        const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (!tableNameRegex.test(tableName)) {
            return res.status(400).json({ error: 'Invalid table name' });
        }
        
        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
        const countParams = [];
        
        if (search) {
            // Try to search in common columns (id, name, email, etc.)
            countQuery += ` WHERE id::text ILIKE $1 OR name ILIKE $1 OR email ILIKE $1`;
            countParams.push(`%${search}%`);
        }
        
        const countResult = await query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        
        // Get data
        let dataQuery = `SELECT * FROM ${tableName}`;
        const dataParams = [];
        
        if (search) {
            dataQuery += ` WHERE id::text ILIKE $1 OR name ILIKE $1 OR email ILIKE $1`;
            dataParams.push(`%${search}%`);
        }
        
        // Validate sort column
        const sortColumnRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (sortColumnRegex.test(sortBy)) {
            dataQuery += ` ORDER BY ${sortBy} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;
        } else {
            // Default to created_at or first column
            try {
                const colCheck = await query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = $1 AND column_name = 'created_at'
                `, [tableName]);
                if (colCheck.rows.length > 0) {
                    dataQuery += ` ORDER BY created_at DESC`;
                }
            } catch (e) {
                // If no created_at, just order by first column
            }
        }
        
        dataQuery += ` LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`;
        dataParams.push(limit, offset);
        
        const dataResult = await query(dataQuery, dataParams);
        
        res.json({
            data: dataResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get table data error:', error);
        res.status(500).json({ error: 'Failed to fetch table data: ' + error.message });
    }
});

// Get table row count
router.get('/tables/:tableName/count', async (req, res) => {
    try {
        const { tableName } = req.params;
        
        // Validate table name
        const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (!tableNameRegex.test(tableName)) {
            return res.status(400).json({ error: 'Invalid table name' });
        }
        
        const result = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
        
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Get table count error:', error);
        res.status(500).json({ error: 'Failed to fetch table count' });
    }
});

// Get table relationships (foreign keys)
router.get('/tables/:tableName/relationships', async (req, res) => {
    try {
        const { tableName } = req.params;
        
        const result = await query(`
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1
        `, [tableName]);
        
        res.json({ relationships: result.rows });
    } catch (error) {
        console.error('Get table relationships error:', error);
        res.status(500).json({ error: 'Failed to fetch table relationships' });
    }
});

module.exports = router;

