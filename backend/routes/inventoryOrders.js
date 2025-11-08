const express = require('express');
const InventoryOrder = require('../models/InventoryOrder');
const Product = require('../models/Product');
const { authenticate, canAccessStore, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get all orders for a store (admin/manager only)
router.get('/store/:storeId', canAccessStore, authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        const { status, search, limit, flat_list, item_status, combine_duplicates } = req.query;
        
        // If flat_list is requested, return all items as a flat list
        if (flat_list === 'true') {
            const filters = {};
            if (status) filters.status = status;
            if (item_status) filters.itemStatus = item_status;
            if (search) filters.search = search;
            if (limit) filters.limit = limit;

            // Default to combining duplicates unless explicitly disabled
            filters.combineDuplicates = combine_duplicates === 'false' ? false : true;

            const items = await InventoryOrder.getAllOrderItems(req.params.storeId, filters);

            if (filters.combineDuplicates) {
                return res.json({ items });
            }

            // Legacy behaviour: add pending quantities for each individual item
            const itemsWithPending = await Promise.all(
                items.map(async (item) => {
                    const pending = await InventoryOrder.getPendingQuantityForVariant(
                        req.params.storeId,
                        item.product_id,
                        item.variant
                    );
                    return {
                        ...item,
                        pending_quantity: pending,
                    };
                })
            );

            return res.json({ items: itemsWithPending });
        }
        
        // Otherwise, return orders grouped by order ID
        const filters = {};
        if (status) filters.status = status;
        if (item_status) filters.itemStatus = item_status;
        if (search) filters.search = search;
        if (limit) filters.limit = limit;

        const orders = await InventoryOrder.findByStore(req.params.storeId, filters);
        
        // Get items for each order
        const ordersWithItems = await Promise.all(
            orders.map(async (order) => {
                const fullOrder = await InventoryOrder.findById(order.id);
                return fullOrder;
            })
        );

        res.json({ orders: ordersWithItems });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get single order by ID
router.get('/:orderId', async (req, res) => {
    try {
        const order = await InventoryOrder.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, order.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ order });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// Create new order (from handheld device)
router.post('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const { items, notes } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Order must have at least one item' });
        }

        // Validate all products exist and are active
        for (const item of items) {
            const product = await Product.findById(item.product_id);
            if (!product || !product.is_active || product.deleted_at) {
                return res.status(400).json({ 
                    error: `Product ${item.product_id} not found or inactive` 
                });
            }
        }

        const order = await InventoryOrder.create(
            req.params.storeId,
            req.user.id,
            { items, notes }
        );

        res.status(201).json({ order, message: 'Order created successfully' });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: error.message || 'Failed to create order' });
    }
});

// Check pending orders for a product (for duplicate prevention)
router.get('/store/:storeId/product/:productId/pending', canAccessStore, async (req, res) => {
    try {
        const { variant } = req.query; // Get variant from query parameter
        console.log('[InventoryOrders] Checking pending orders:', {
            storeId: req.params.storeId,
            productId: req.params.productId,
            variant: variant || null
        });
        const pendingOrders = await InventoryOrder.getPendingOrdersForProduct(
            req.params.storeId,
            req.params.productId,
            variant || null // Pass variant if provided, otherwise null
        );
        console.log('[InventoryOrders] Found pending orders:', pendingOrders.length);
        res.json({ pending_orders: pendingOrders });
    } catch (error) {
        console.error('[InventoryOrders] Get pending orders error:', error);
        console.error('[InventoryOrders] Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch pending orders',
            details: error.message 
        });
    }
});

// Update order item quantity (admin/manager only)
router.put('/items/:itemId/quantity', authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        const { quantity } = req.body;
        if (!quantity || quantity < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1' });
        }

        const item = await InventoryOrder.updateItemQuantity(req.params.itemId, quantity);
        if (!item) {
            return res.status(404).json({ error: 'Order item not found' });
        }

        res.json({ item, message: 'Quantity updated successfully' });
    } catch (error) {
        console.error('Update quantity error:', error);
        res.status(500).json({ error: 'Failed to update quantity' });
    }
});

// Remove item from order (admin/manager only)
router.delete('/items/:itemId', authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        await InventoryOrder.removeItem(req.params.itemId);
        res.json({ message: 'Item removed from order successfully' });
    } catch (error) {
        console.error('Remove item error:', error);
        res.status(500).json({ error: 'Failed to remove item' });
    }
});

// Mark item as delivered (admin/manager only)
router.post('/items/:itemId/delivered', authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        const { quantity_delivered } = req.body;
        const item = await InventoryOrder.markItemDelivered(
            req.params.itemId,
            quantity_delivered
        );
        res.json({ item, message: 'Item marked as delivered' });
    } catch (error) {
        console.error('Mark delivered error:', error);
        res.status(500).json({ error: error.message || 'Failed to mark item as delivered' });
    }
});

// Cancel order (admin/manager only)
router.post('/:orderId/cancel', authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        const order = await InventoryOrder.cancelOrder(req.params.orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ order, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

module.exports = router;

