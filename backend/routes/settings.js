const express = require('express');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');
const ChartOfAccounts = require('../models/ChartOfAccounts');
const ExpenseType = require('../models/ExpenseType');
const OtherIncomeCategory = require('../models/OtherIncomeCategory');

const router = express.Router();

router.use(authenticate);

// Most routes require admin, but some allow super_admin too
// We'll handle authorization per route

// ========== Chart of Accounts Routes ==========

router.get('/chart-of-accounts/store/:storeId', authorize('admin', 'super_admin'), canAccessStore, async (req, res) => {
    try {
        const accounts = await ChartOfAccounts.findByStore(req.params.storeId);
        res.json({ accounts });
    } catch (error) {
        console.error('Get chart of accounts error:', error);
        res.status(500).json({ error: 'Failed to fetch chart of accounts' });
    }
});

router.post('/chart-of-accounts/store/:storeId', authorize('admin', 'super_admin'), canAccessStore, async (req, res) => {
    try {
        const { account_code, account_name, account_type, parent_account_id } = req.body;
        
        if (!account_name || !account_type) {
            return res.status(400).json({ error: 'Account name and account type are required' });
        }

        const account = await ChartOfAccounts.create({
            store_id: req.params.storeId,
            account_code,
            account_name,
            account_type,
            parent_account_id,
            created_by: req.user.id
        });

        res.status(201).json({
            message: 'Account created successfully',
            account
        });
    } catch (error) {
        console.error('Create account error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'An account with this name already exists for this store' });
        }
        res.status(500).json({ error: 'Failed to create account' });
    }
});

router.put('/chart-of-accounts/:accountId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const account = await ChartOfAccounts.findById(req.params.accountId);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, account.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updated = await ChartOfAccounts.update(req.params.accountId, req.body);
        res.json({
            message: 'Account updated successfully',
            account: updated
        });
    } catch (error) {
        console.error('Update account error:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
});

router.delete('/chart-of-accounts/:accountId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const account = await ChartOfAccounts.findById(req.params.accountId);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, account.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        await ChartOfAccounts.delete(req.params.accountId);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// ========== Expense Types Routes ==========

router.get('/expense-types/store/:storeId', authorize('admin', 'super_admin'), canAccessStore, async (req, res) => {
    try {
        const expenseTypes = await ExpenseType.findByStore(req.params.storeId);
        res.json({ expense_types: expenseTypes });
    } catch (error) {
        console.error('Get expense types error:', error);
        res.status(500).json({ error: 'Failed to fetch expense types' });
    }
});

router.post('/expense-types/store/:storeId', authorize('admin', 'super_admin'), canAccessStore, async (req, res) => {
    try {
        const { expense_type_name, description } = req.body;
        
        if (!expense_type_name) {
            return res.status(400).json({ error: 'Expense type name is required' });
        }

        const expenseType = await ExpenseType.create({
            store_id: req.params.storeId,
            expense_type_name,
            description,
            created_by: req.user.id
        });

        res.status(201).json({
            message: 'Expense type created successfully',
            expense_type: expenseType
        });
    } catch (error) {
        console.error('Create expense type error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'An expense type with this name already exists for this store' });
        }
        res.status(500).json({ error: 'Failed to create expense type' });
    }
});

router.put('/expense-types/:expenseTypeId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const expenseType = await ExpenseType.findById(req.params.expenseTypeId);
        if (!expenseType) {
            return res.status(404).json({ error: 'Expense type not found' });
        }

        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, expenseType.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updated = await ExpenseType.update(req.params.expenseTypeId, req.body);
        res.json({
            message: 'Expense type updated successfully',
            expense_type: updated
        });
    } catch (error) {
        console.error('Update expense type error:', error);
        res.status(500).json({ error: 'Failed to update expense type' });
    }
});

router.delete('/expense-types/:expenseTypeId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const expenseType = await ExpenseType.findById(req.params.expenseTypeId);
        if (!expenseType) {
            return res.status(404).json({ error: 'Expense type not found' });
        }

        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, expenseType.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        await ExpenseType.delete(req.params.expenseTypeId);
        res.json({ message: 'Expense type deleted successfully' });
    } catch (error) {
        console.error('Delete expense type error:', error);
        res.status(500).json({ error: 'Failed to delete expense type' });
    }
});

// ========== Other Income Categories Routes ==========

router.get('/other-income/store/:storeId', authorize('admin', 'super_admin'), canAccessStore, async (req, res) => {
    try {
        const categories = await OtherIncomeCategory.findByStore(req.params.storeId);
        res.json({ categories });
    } catch (error) {
        console.error('Get other income categories error:', error);
        res.status(500).json({ error: 'Failed to fetch other income categories' });
    }
});

router.post('/other-income/store/:storeId', authorize('admin', 'super_admin'), canAccessStore, async (req, res) => {
    try {
        const { category_name, description } = req.body;
        
        if (!category_name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const category = await OtherIncomeCategory.create({
            store_id: req.params.storeId,
            category_name,
            description,
            created_by: req.user.id
        });

        res.status(201).json({
            message: 'Category created successfully',
            category
        });
    } catch (error) {
        console.error('Create category error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'A category with this name already exists for this store' });
        }
        res.status(500).json({ error: 'Failed to create category' });
    }
});

router.put('/other-income/:categoryId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const category = await OtherIncomeCategory.findById(req.params.categoryId);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, category.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updated = await OtherIncomeCategory.update(req.params.categoryId, req.body);
        res.json({
            message: 'Category updated successfully',
            category: updated
        });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

router.delete('/other-income/:categoryId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const category = await OtherIncomeCategory.findById(req.params.categoryId);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, category.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        await OtherIncomeCategory.delete(req.params.categoryId);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// ========== Copy/Clone Routes ==========

// Get available stores for copying (based on user role)
router.get('/copy/stores', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const AdminConfig = require('../models/AdminConfig');
        let stores;

        if (req.user.role === 'super_admin') {
            // Super admin can see all stores (from all admins)
            stores = await AdminConfig.getAccessibleStores(req.user.id, 'super_admin', null, true);
        } else if (req.user.role === 'admin') {
            // Admin can only see their own stores
            stores = await AdminConfig.getAccessibleStores(req.user.id, 'admin', null, true);
        } else {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Filter out the source store if provided
        const { exclude_store_id } = req.query;
        if (exclude_store_id) {
            stores = stores.filter(s => s.id !== exclude_store_id);
        }

        res.json({ stores });
    } catch (error) {
        console.error('Get stores for copy error:', error);
        res.status(500).json({ error: 'Failed to fetch stores' });
    }
});

// Copy Chart of Accounts
router.post('/chart-of-accounts/copy', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { source_store_id, target_store_ids } = req.body;
        
        if (!source_store_id || !target_store_ids || !Array.isArray(target_store_ids) || target_store_ids.length === 0) {
            return res.status(400).json({ error: 'Source store ID and target store IDs are required' });
        }

        // Verify user has access to source store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, source_store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to source store.' });
        }

        // Get source accounts
        const sourceAccounts = await ChartOfAccounts.findByStore(source_store_id);

        const results = [];
        for (const targetStoreId of target_store_ids) {
            // Verify access to target store
            const targetAccessResult = await query(
                'SELECT can_user_access_store($1, $2) as can_access',
                [req.user.id, targetStoreId]
            );
            
            if (!targetAccessResult.rows[0]?.can_access) {
                results.push({ store_id: targetStoreId, error: 'Access denied' });
                continue;
            }

            // Create a map of old parent IDs to new IDs for this target store
            const parentIdMap = new Map();
            const copiedAccounts = [];

            // Copy accounts without parents first
            for (const account of sourceAccounts) {
                if (!account.parent_account_id) {
                    const newAccount = await ChartOfAccounts.create({
                        store_id: targetStoreId,
                        account_code: account.account_code,
                        account_name: account.account_name,
                        account_type: account.account_type,
                        parent_account_id: null,
                        created_by: req.user.id
                    });
                    parentIdMap.set(account.id, newAccount.id);
                    copiedAccounts.push(newAccount);
                }
            }

            // Copy accounts with parents
            for (const account of sourceAccounts) {
                if (account.parent_account_id && !parentIdMap.has(account.id)) {
                    const newParentId = parentIdMap.get(account.parent_account_id);
                    if (newParentId) {
                        const newAccount = await ChartOfAccounts.create({
                            store_id: targetStoreId,
                            account_code: account.account_code,
                            account_name: account.account_name,
                            account_type: account.account_type,
                            parent_account_id: newParentId,
                            created_by: req.user.id
                        });
                        parentIdMap.set(account.id, newAccount.id);
                        copiedAccounts.push(newAccount);
                    }
                }
            }

            results.push({ store_id: targetStoreId, count: copiedAccounts.length, success: true });
        }

        res.json({
            message: 'Chart of accounts copied successfully',
            results
        });
    } catch (error) {
        console.error('Copy chart of accounts error:', error);
        res.status(500).json({ error: 'Failed to copy chart of accounts' });
    }
});

// Copy Departments
router.post('/departments/copy', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { source_store_id, target_store_ids } = req.body;
        
        if (!source_store_id || !target_store_ids || !Array.isArray(target_store_ids) || target_store_ids.length === 0) {
            return res.status(400).json({ error: 'Source store ID and target store IDs are required' });
        }

        // Verify user has access to source store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, source_store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to source store.' });
        }

        const Department = require('../models/Department');
        const sourceDepartments = await Department.findByStore(source_store_id);

        const results = [];
        for (const targetStoreId of target_store_ids) {
            // Verify access to target store
            const targetAccessResult = await query(
                'SELECT can_user_access_store($1, $2) as can_access',
                [req.user.id, targetStoreId]
            );
            
            if (!targetAccessResult.rows[0]?.can_access) {
                results.push({ store_id: targetStoreId, error: 'Access denied' });
                continue;
            }

            const copied = [];
            for (const dept of sourceDepartments) {
                const newDept = await Department.create(targetStoreId, {
                    name: dept.name,
                    description: dept.description
                });
                copied.push(newDept);
            }

            results.push({ store_id: targetStoreId, count: copied.length, success: true });
        }

        res.json({
            message: 'Departments copied successfully',
            results
        });
    } catch (error) {
        console.error('Copy departments error:', error);
        res.status(500).json({ error: 'Failed to copy departments' });
    }
});

// Copy Vendors
router.post('/vendors/copy', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { source_store_id, target_store_ids } = req.body;
        
        if (!source_store_id || !target_store_ids || !Array.isArray(target_store_ids) || target_store_ids.length === 0) {
            return res.status(400).json({ error: 'Source store ID and target store IDs are required' });
        }

        // Verify user has access to source store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, source_store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to source store.' });
        }

        const Vendor = require('../models/Vendor');
        const sourceVendors = await Vendor.findByStore(source_store_id);

        const results = [];
        for (const targetStoreId of target_store_ids) {
            // Verify access to target store
            const targetAccessResult = await query(
                'SELECT can_user_access_store($1, $2) as can_access',
                [req.user.id, targetStoreId]
            );
            
            if (!targetAccessResult.rows[0]?.can_access) {
                results.push({ store_id: targetStoreId, error: 'Access denied' });
                continue;
            }

            const copied = [];
            for (const vendor of sourceVendors) {
                const newVendor = await Vendor.create(targetStoreId, {
                    name: vendor.name,
                    contact_name: vendor.contact_name,
                    email: vendor.email,
                    phone: vendor.phone,
                    address: vendor.address,
                    city: vendor.city,
                    state: vendor.state,
                    zip_code: vendor.zip_code,
                    notes: vendor.notes
                });
                copied.push(newVendor);
            }

            results.push({ store_id: targetStoreId, count: copied.length, success: true });
        }

        res.json({
            message: 'Vendors copied successfully',
            results
        });
    } catch (error) {
        console.error('Copy vendors error:', error);
        res.status(500).json({ error: 'Failed to copy vendors' });
    }
});

// Copy Expense Types
router.post('/expense-types/copy', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { source_store_id, target_store_ids } = req.body;
        
        if (!source_store_id || !target_store_ids || !Array.isArray(target_store_ids) || target_store_ids.length === 0) {
            return res.status(400).json({ error: 'Source store ID and target store IDs are required' });
        }

        // Verify user has access to source store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, source_store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to source store.' });
        }

        const sourceExpenseTypes = await ExpenseType.findByStore(source_store_id);

        const results = [];
        for (const targetStoreId of target_store_ids) {
            // Verify access to target store
            const targetAccessResult = await query(
                'SELECT can_user_access_store($1, $2) as can_access',
                [req.user.id, targetStoreId]
            );
            
            if (!targetAccessResult.rows[0]?.can_access) {
                results.push({ store_id: targetStoreId, error: 'Access denied' });
                continue;
            }

            const copied = [];
            for (const expenseType of sourceExpenseTypes) {
                const newExpenseType = await ExpenseType.create({
                    store_id: targetStoreId,
                    expense_type_name: expenseType.expense_type_name,
                    description: expenseType.description,
                    created_by: req.user.id
                });
                copied.push(newExpenseType);
            }

            results.push({ store_id: targetStoreId, count: copied.length, success: true });
        }

        res.json({
            message: 'Expense types copied successfully',
            results
        });
    } catch (error) {
        console.error('Copy expense types error:', error);
        res.status(500).json({ error: 'Failed to copy expense types' });
    }
});

// Copy Other Income Categories
router.post('/other-income/copy', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { source_store_id, target_store_ids } = req.body;
        
        if (!source_store_id || !target_store_ids || !Array.isArray(target_store_ids) || target_store_ids.length === 0) {
            return res.status(400).json({ error: 'Source store ID and target store IDs are required' });
        }

        // Verify user has access to source store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, source_store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to source store.' });
        }

        const sourceCategories = await OtherIncomeCategory.findByStore(source_store_id);

        const results = [];
        for (const targetStoreId of target_store_ids) {
            // Verify access to target store
            const targetAccessResult = await query(
                'SELECT can_user_access_store($1, $2) as can_access',
                [req.user.id, targetStoreId]
            );
            
            if (!targetAccessResult.rows[0]?.can_access) {
                results.push({ store_id: targetStoreId, error: 'Access denied' });
                continue;
            }

            const copied = [];
            for (const category of sourceCategories) {
                const newCategory = await OtherIncomeCategory.create({
                    store_id: targetStoreId,
                    category_name: category.category_name,
                    description: category.description,
                    created_by: req.user.id
                });
                copied.push(newCategory);
            }

            results.push({ store_id: targetStoreId, count: copied.length, success: true });
        }

        res.json({
            message: 'Other income categories copied successfully',
            results
        });
    } catch (error) {
        console.error('Copy other income categories error:', error);
        res.status(500).json({ error: 'Failed to copy other income categories' });
    }
});

module.exports = router;

