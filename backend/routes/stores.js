const express = require('express');
const Store = require('../models/Store');
const StoreManager = require('../models/StoreManager');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all stores (filtered by user role)
router.get('/', async (req, res) => {
    try {
        const AdminConfig = require('../models/AdminConfig');
        // For admin and manager, always include inactive (deactivated) stores - they should see them
        // Only filter out deleted stores (deleted_at IS NOT NULL)
        const includeInactive = req.user.role !== 'employee'; // Employees only see active stores
        const stores = await AdminConfig.getAccessibleStores(req.user.id, req.user.role, null, includeInactive);
        res.json({ stores });
    } catch (error) {
        console.error('Get stores error:', error);
        res.status(500).json({ error: 'Failed to fetch stores' });
    }
});

// Get single store by ID
router.get('/:storeId', canAccessStore, async (req, res) => {
    try {
        const store = await Store.findByIdWithTemplate(req.params.storeId);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        res.json({ store });
    } catch (error) {
        console.error('Get store error:', error);
        res.status(500).json({ error: 'Failed to fetch store' });
    }
});

// Create new store (only super_admin and admin)
router.post('/', authorize('super_admin', 'admin'), auditLogger({
    actionType: 'create',
    entityType: 'store',
    getEntityId: (req) => null, // Will be captured from response
    getDescription: (req) => `Created store: ${req.body?.name || 'N/A'}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        console.log('Store creation request:', {
            user: req.user.id,
            role: req.user.role,
            body: req.body
        });
        
        // Check if admin can create more stores
        if (req.user.role === 'admin') {
            const AdminConfig = require('../models/AdminConfig');
            const canCreate = await AdminConfig.canCreateStore(req.user.id);
            if (!canCreate) {
                return res.status(403).json({ 
                    error: 'Store creation limit reached. Please contact super admin.' 
                });
            }
        }
        
        const { name, address, city, state, zip_code, phone, admin_id, manager_id, template_id, lottery_retailer_id, created_by } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Store name is required' });
        }
        
        // Clean up empty strings to null
        const cleanValue = (val) => (val === '' || val === undefined) ? null : val;
        
        // Super admin can create stores for any admin
        // Regular admin creates stores for themselves
        let finalAdminId, finalCreatedBy;
        
        if (req.user.role === 'super_admin') {
            // Super admin can specify admin_id or created_by
            // If admin_id is provided, validate it exists and is an admin
            const cleanedAdminId = cleanValue(admin_id);
            const cleanedCreatedBy = cleanValue(created_by);
            
            if (cleanedAdminId) {
                // Validate that the admin_id exists, is active, and is an admin
                const User = require('../models/User');
                const adminUser = await User.findById(cleanedAdminId);
                if (!adminUser) {
                    return res.status(400).json({ 
                        error: 'Invalid admin: The selected admin does not exist. Please refresh the page and select a valid admin.' 
                    });
                }
                if (!adminUser.is_active) {
                    return res.status(400).json({ 
                        error: 'Invalid admin: The selected admin is inactive. Please select an active admin.' 
                    });
                }
                if (adminUser.role !== 'admin' && adminUser.role !== 'super_admin') {
                    return res.status(400).json({ 
                        error: 'Invalid admin: The selected user is not an admin.' 
                    });
                }
                finalAdminId = cleanedAdminId;
            } else if (cleanedCreatedBy) {
                // If created_by is provided, validate it exists
                const User = require('../models/User');
                const creatorUser = await User.findById(cleanedCreatedBy);
                if (!creatorUser) {
                    return res.status(400).json({ 
                        error: 'Invalid creator: The selected user does not exist.' 
                    });
                }
                finalAdminId = cleanedCreatedBy; // Use created_by as admin_id if no admin_id provided
            } else {
                // No admin specified, super admin can create without assigning
                finalAdminId = null;
            }
            
            finalCreatedBy = cleanedCreatedBy || cleanedAdminId || req.user.id;
        } else {
            // Admin creates for themselves - validate they still exist and are admin
            const User = require('../models/User');
            const currentUser = await User.findById(req.user.id);
            if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
                return res.status(403).json({ 
                    error: 'Your account is no longer valid for creating stores.' 
                });
            }
            finalAdminId = cleanValue(admin_id) || req.user.id;
            finalCreatedBy = req.user.id;
        }
        
        console.log('Creating store with data:', {
            name,
            address: cleanValue(address),
            city: cleanValue(city),
            state: cleanValue(state),
            zip_code: cleanValue(zip_code),
            phone: cleanValue(phone),
            admin_id: finalAdminId,
            manager_id: cleanValue(manager_id),
            template_id: cleanValue(template_id),
            lottery_retailer_id: cleanValue(lottery_retailer_id),
            created_by: finalCreatedBy
        });
        
        const store = await Store.create({
            name,
            address: cleanValue(address),
            city: cleanValue(city),
            state: cleanValue(state),
            zip_code: cleanValue(zip_code),
            phone: cleanValue(phone),
            admin_id: finalAdminId,
            manager_id: cleanValue(manager_id),
            template_id: cleanValue(template_id),
            lottery_retailer_id: cleanValue(lottery_retailer_id),
            created_by: finalCreatedBy
        });
        
        console.log('Store created successfully:', store.id);
        
        // Automatically create store subscription based on template with auto-renew enabled
        const cleanedTemplateId = cleanValue(template_id);
        if (cleanedTemplateId) {
            try {
                const StoreSubscription = require('../models/StoreSubscription');
                const StoreTemplate = require('../models/StoreTemplate');
                const template = await StoreTemplate.findById(cleanedTemplateId);
                
                if (!template) {
                    console.warn(`Template ${cleanedTemplateId} not found, skipping subscription creation`);
                } else {
                    await StoreSubscription.upsert(store.id, {
                        template_id: cleanedTemplateId,
                        billing_cycle: template?.billing_cycle || 'monthly',
                        start_date: new Date().toISOString().split('T')[0],
                        auto_renew: true // Enable auto-renew by default
                    });
                }
            } catch (subError) {
                console.error('Error creating store subscription:', subError);
                console.error('Subscription error details:', subError.message);
                console.error('Subscription error stack:', subError.stack);
                // Don't fail store creation if subscription creation fails
            }
        }
        
        res.status(201).json({
            message: 'Store created successfully',
            store
        });
    } catch (error) {
        console.error('Create store error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to create store',
            details: error.message 
        });
    }
});

// Update store (only super_admin and admin)
router.put('/:storeId', authorize('super_admin', 'admin'), canAccessStore, auditLogger({
    actionType: 'update',
    entityType: 'store',
    getEntityId: (req) => req.params.storeId,
    getDescription: (req) => `Updated store: ${req.params.storeId}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const store = await Store.findById(req.params.storeId);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        // Remove store_type from update data if present
        const updateData = { ...req.body };
        delete updateData.store_type;
        
        const updatedStore = await Store.update(req.params.storeId, updateData);
        
        // If template_id changed, update subscription with auto-renew
        if (updateData.template_id !== undefined && updateData.template_id !== store.template_id) {
            try {
                const StoreSubscription = require('../models/StoreSubscription');
                const StoreTemplate = require('../models/StoreTemplate');
                
                if (updateData.template_id) {
                    // Assign new subscription
                    const template = await StoreTemplate.findById(updateData.template_id);
                    await StoreSubscription.upsert(req.params.storeId, {
                        template_id: updateData.template_id,
                        billing_cycle: template?.billing_cycle || 'monthly',
                        start_date: new Date().toISOString().split('T')[0],
                        auto_renew: true // Enable auto-renew
                    });
                } else {
                    // Remove subscription
                    await StoreSubscription.recalculate(req.params.storeId);
                }
            } catch (subError) {
                console.error('Error updating store subscription:', subError);
                // Don't fail store update if subscription update fails
            }
        }
        res.json({
            message: 'Store updated successfully',
            store: updatedStore
        });
    } catch (error) {
        console.error('Update store error:', error);
        res.status(500).json({ error: 'Failed to update store' });
    }
});

// Toggle store active status (admin can activate/deactivate their stores)
router.patch('/:storeId/toggle-active', authorize('super_admin', 'admin'), canAccessStore, async (req, res) => {
    try {
        const store = await Store.findById(req.params.storeId);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        // Admin can only toggle stores they created
        if (req.user.role === 'admin' && store.created_by !== req.user.id) {
            return res.status(403).json({ error: 'You can only modify stores you created' });
        }
        
        const updatedStore = await Store.toggleActive(req.params.storeId);
        res.json({
            message: updatedStore.is_active ? 'Store activated successfully' : 'Store deactivated successfully',
            store: updatedStore
        });
    } catch (error) {
        console.error('Toggle store active error:', error);
        res.status(500).json({ error: 'Failed to toggle store status' });
    }
});

// Delete store (soft delete - only super_admin, can be restored)
router.delete('/:storeId', authorize('super_admin'), auditLogger({
    actionType: 'delete',
    entityType: 'store',
    getEntityId: (req) => req.params.storeId,
    getDescription: (req) => `Deleted store: ${req.params.storeId}`,
    logRequestBody: false
}), async (req, res) => {
    try {
        const store = await Store.findById(req.params.storeId);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        const deletedStore = await Store.delete(req.params.storeId);
        if (!deletedStore) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        res.json({ 
            message: 'Store deleted successfully (can be restored)',
            store: deletedStore
        });
    } catch (error) {
        console.error('Delete store error:', error);
        res.status(500).json({ error: 'Failed to delete store' });
    }
});

// Restore deleted store (only super_admin)
router.post('/:storeId/restore', authorize('super_admin'), async (req, res) => {
    try {
        const store = await Store.findById(req.params.storeId);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        if (store.is_active) {
            return res.status(400).json({ error: 'Store is already active' });
        }
        
        const restoredStore = await Store.restore(req.params.storeId);
        res.json({
            message: 'Store restored successfully',
            store: restoredStore
        });
    } catch (error) {
        console.error('Restore store error:', error);
        res.status(500).json({ error: 'Failed to restore store' });
    }
});

// Assign employee to store
router.post('/:storeId/employees', authorize('super_admin', 'admin'), canAccessStore, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        const assignment = await Store.assignEmployee(req.params.storeId, userId);
        if (!assignment) {
            return res.status(400).json({ error: 'Employee already assigned to this store' });
        }
        
        res.status(201).json({
            message: 'Employee assigned successfully',
            assignment
        });
    } catch (error) {
        console.error('Assign employee error:', error);
        res.status(500).json({ error: 'Failed to assign employee' });
    }
});

// Remove employee from store
router.delete('/:storeId/employees/:userId', authorize('super_admin', 'admin'), canAccessStore, async (req, res) => {
    try {
        const assignment = await Store.removeEmployee(req.params.storeId, req.params.userId);
        if (!assignment) {
            return res.status(404).json({ error: 'Employee assignment not found' });
        }
        
        res.json({ message: 'Employee removed from store successfully' });
    } catch (error) {
        console.error('Remove employee error:', error);
        res.status(500).json({ error: 'Failed to remove employee' });
    }
});

// Get store employees
router.get('/:storeId/employees', canAccessStore, async (req, res) => {
    try {
        const employees = await Store.getEmployees(req.params.storeId);
        res.json({ employees });
    } catch (error) {
        console.error('Get store employees error:', error);
        res.status(500).json({ error: 'Failed to fetch store employees' });
    }
});

// Assign manager to store (admin only)
router.post('/:storeId/managers', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { manager_id, can_edit, can_view_reports, can_manage_employees } = req.body;
        
        if (!manager_id) {
            return res.status(400).json({ error: 'manager_id is required' });
        }
        
        // Check if store has manager_access feature addon
        const StoreSubscription = require('../models/StoreSubscription');
        const addonFeatures = await StoreSubscription.getAddonFeatures(req.params.storeId);
        
        if (!addonFeatures.includes('manager_access')) {
            return res.status(403).json({ 
                error: 'Manager access feature addon is required. Please add "Manager Access" feature addon to this store\'s subscription first.' 
            });
        }
        
        const assignment = await StoreManager.assign(
            req.params.storeId,
            manager_id,
            {
                can_edit: can_edit !== false,
                can_view_reports: can_view_reports !== false,
                can_manage_employees: can_manage_employees === true
            },
            req.user.id
        );
        
        res.json({
            message: 'Manager assigned successfully',
            assignment
        });
    } catch (error) {
        console.error('Error assigning manager:', error);
        res.status(500).json({ error: 'Failed to assign manager', details: error.message });
    }
});

// Remove manager from store
router.delete('/:storeId/managers/:managerId', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const assignment = await StoreManager.unassign(req.params.storeId, req.params.managerId);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        res.json({ message: 'Manager removed successfully' });
    } catch (error) {
        console.error('Error removing manager:', error);
        res.status(500).json({ error: 'Failed to remove manager' });
    }
});

// Get managers for a store
router.get('/:storeId/managers', canAccessStore, async (req, res) => {
    try {
        const managers = await StoreManager.findByStore(req.params.storeId);
        res.json({ managers });
    } catch (error) {
        console.error('Error fetching managers:', error);
        res.status(500).json({ error: 'Failed to fetch managers' });
    }
});

module.exports = router;

