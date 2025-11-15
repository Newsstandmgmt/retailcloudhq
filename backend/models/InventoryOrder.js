const { query } = require('../config/database');

class InventoryOrder {
    constructor(data) {
        Object.assign(this, data);
    }

    // Generate order ID
    static async generateOrderId() {
        const result = await query('SELECT generate_order_id() as order_id');
        return result.rows[0].order_id;
    }

    // Create a new order
    static async create(storeId, submittedBy, orderData) {
        const { items, notes } = orderData;

        if (!items || items.length === 0) {
            throw new Error('Order must have at least one item');
        }

        // Get user name for caching
        const User = require('./User');
        const user = await User.findById(submittedBy);
        const submittedByName = user ? `${user.first_name} ${user.last_name}` : 'Unknown';

        // Generate order ID
        const orderId = await this.generateOrderId();

        // Start transaction
        const client = await query.getClient ? await query.getClient() : null;
        
        try {
            if (client) {
                await client.query('BEGIN');
            }

            // Create order
            const orderResult = await query(
                `INSERT INTO inventory_orders 
                (order_id, store_id, submitted_by, submitted_by_name, notes, status)
                VALUES ($1, $2, $3, $4, $5, 'pending')
                RETURNING *`,
                [orderId, storeId, submittedBy, submittedByName, notes || null]
            );

            const order = orderResult.rows[0];

            // Create order items
            for (const item of items) {
                const { product_id, quantity, variant } = item; // Get variant from request

                // Get product details for caching
                const Product = require('./Product');
                const product = await Product.findById(product_id);
                if (!product) {
                    throw new Error(`Product ${product_id} not found`);
                }

                // Use variant from request if provided, otherwise use product's default variant
                const finalVariant = variant !== undefined ? variant : (product.variant || null);

                await query(
                    `INSERT INTO inventory_order_items 
                    (order_id, product_id, product_name, variant, supplier, upc, quantity, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                    RETURNING *`,
                    [
                        order.id,
                        product_id,
                        product.full_product_name || product.product_name,
                        finalVariant, // Use variant from request
                        product.supplier || null,
                        product.upc || null,
                        parseInt(quantity) || 1
                    ]
                );
            }

            if (client) {
                await client.query('COMMIT');
            }

            // Get full order with items
            return await this.findById(order.id);
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            throw error;
        } finally {
            if (client && client.release) {
                client.release();
            }
        }
    }

    // Get order by ID
    static async findById(orderId) {
        const result = await query(
            `SELECT o.*, 
                   COUNT(oi.id) as item_count,
                   SUM(oi.quantity) as total_quantity
            FROM inventory_orders o
            LEFT JOIN inventory_order_items oi ON oi.order_id = o.id
            WHERE o.id = $1
            GROUP BY o.id`,
            [orderId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const order = result.rows[0];

        // Get order items
        const itemsResult = await query(
            `SELECT oi.*, p.product_id as product_sku, p.category, p.brand
            FROM inventory_order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = $1
            ORDER BY oi.created_at`,
            [orderId]
        );

        order.items = itemsResult.rows;
        return order;
    }

    // Get orders by store
    static async findByStore(storeId, filters = {}) {
        let sql = `
            SELECT o.*, 
                   COUNT(oi.id) as item_count,
                   SUM(oi.quantity) as total_quantity
            FROM inventory_orders o
            LEFT JOIN inventory_order_items oi ON oi.order_id = o.id
            WHERE o.store_id = $1
        `;
        const params = [storeId];
        let paramIndex = 2;

        if (filters.status) {
            sql += ` AND o.status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters.search) {
            sql += ` AND (
                o.order_id ILIKE $${paramIndex} OR
                o.submitted_by_name ILIKE $${paramIndex}
            )`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        sql += ` GROUP BY o.id ORDER BY o.created_at DESC`;

        if (filters.limit) {
            sql += ` LIMIT $${paramIndex}`;
            params.push(parseInt(filters.limit));
        }

        const result = await query(sql, params);
        return result.rows;
    }

    // Public helper used by the API – prefers aggregated view but falls back when unavailable
    static async getAllOrderItems(storeId, filters = {}) {
        if (filters.combineDuplicates) {
            try {
                return await this.getAggregatedOrderItems(storeId, filters);
            } catch (error) {
                console.error('[InventoryOrder] Aggregated order items failed, falling back to flat list:', error.message);
                // Continue with flat list so the UI still works even if the DB is missing new columns
            }
        }

        return this.getFlatOrderItems(storeId, filters);
    }

    // Get all order items without aggregation (legacy behaviour)
    static async getFlatOrderItems(storeId, filters = {}) {
        let sql = `
            SELECT 
                oi.*,
                o.order_id,
                o.created_at as order_date,
                o.submitted_by_name,
                o.status as order_status,
                p.product_id as product_sku,
                p.category,
                p.brand
            FROM inventory_order_items oi
            JOIN inventory_orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE o.store_id = $1
        `;
        const params = [storeId];
        let paramIndex = 2;

        if (filters.status) {
            sql += ` AND o.status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters.itemStatus) {
            // Handle comma-separated statuses (e.g., 'pending,partially_delivered')
            if (filters.itemStatus.includes(',')) {
                const statuses = filters.itemStatus.split(',').map(s => s.trim());
                sql += ` AND oi.status = ANY($${paramIndex})`;
                params.push(statuses);
            } else {
                sql += ` AND oi.status = $${paramIndex}`;
                params.push(filters.itemStatus);
            }
            paramIndex++;
        }

        if (filters.search) {
            sql += ` AND (
                o.order_id ILIKE $${paramIndex} OR
                oi.product_name ILIKE $${paramIndex} OR
                oi.variant ILIKE $${paramIndex} OR
                o.submitted_by_name ILIKE $${paramIndex}
            )`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        sql += ` ORDER BY o.created_at DESC, oi.created_at DESC`;

        if (filters.limit) {
            sql += ` LIMIT $${paramIndex}`;
            params.push(parseInt(filters.limit));
        }

        const result = await query(sql, params);
        return result.rows;
    }

    // Get aggregated order items grouped by product/variant
    static async getAggregatedOrderItems(storeId, filters = {}) {
        let sql = `
            WITH item_data AS (
                SELECT 
                    oi.id,
                    oi.product_id,
                    oi.product_name,
                    oi.variant,
                    oi.supplier,
                    oi.quantity,
                    COALESCE(oi.quantity_delivered, 0) AS quantity_delivered,
                    (oi.quantity - COALESCE(oi.quantity_delivered, 0)) AS pending_quantity,
                    oi.status AS item_status,
                    o.order_id,
                    o.created_at,
                    o.submitted_by_name,
                    o.status AS order_status,
                    p.product_id AS product_sku,
                    p.category,
                    p.brand
                FROM inventory_order_items oi
                JOIN inventory_orders o ON o.id = oi.order_id
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE o.store_id = $1
        `;

        const params = [storeId];
        let paramIndex = 2;

        if (filters.status) {
            sql += ` AND o.status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters.itemStatus) {
            const statuses = filters.itemStatus.split(',').map(s => s.trim()).filter(Boolean);
            if (statuses.length) {
                sql += ` AND oi.status = ANY($${paramIndex}::text[])`;
                params.push(statuses);
                paramIndex++;
            }
        }

        if (filters.search) {
            sql += ` AND (
                o.order_id ILIKE $${paramIndex} OR
                oi.product_name ILIKE $${paramIndex} OR
                COALESCE(oi.variant, '') ILIKE $${paramIndex} OR
                o.submitted_by_name ILIKE $${paramIndex}
            )`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        sql += `
            )
            , aggregated AS (
                SELECT 
                    MIN(id) AS id,
                    product_id,
                    product_name,
                    variant,
                    MAX(supplier) AS supplier,
                    SUM(quantity)::int AS total_quantity,
                    SUM(quantity_delivered)::int AS total_delivered,
                    SUM(pending_quantity)::int AS pending_quantity,
                    CASE 
                        WHEN SUM(pending_quantity) <= 0 THEN 'delivered'
                        WHEN SUM(quantity_delivered) > 0 THEN 'partially_delivered'
                        ELSE 'pending'
                    END AS combined_status,
                    MAX(product_sku) AS product_sku,
                    MAX(category) AS category,
                    MAX(brand) AS brand,
                    json_agg(
                        json_build_object(
                            'order_item_id', id,
                            'order_id', order_id,
                            'order_date', created_at,
                            'quantity', quantity,
                            'delivered', quantity_delivered,
                            'pending', pending_quantity,
                            'status', item_status,
                            'order_status', order_status,
                            'submitted_by_name', submitted_by_name
                        )
                        ORDER BY created_at
                    ) AS order_history,
                    MAX(created_at) AS latest_order_date
                FROM item_data
                GROUP BY product_id, product_name, variant
            )
            SELECT * FROM aggregated
        `;

        sql += ` ORDER BY latest_order_date DESC`;

        if (filters.limit) {
            sql += ` LIMIT $${paramIndex}`;
            params.push(parseInt(filters.limit));
        }

        const result = await query(sql, params);
        return result.rows;
    }

    // Get pending quantity for a specific product variant
    static async getPendingQuantityForVariant(storeId, productId, variant = null) {
        let sql = `
            SELECT SUM(oi.quantity - COALESCE(oi.quantity_delivered, 0)) as pending_quantity
            FROM inventory_order_items oi
            JOIN inventory_orders o ON o.id = oi.order_id
            WHERE oi.product_id = $1 
            AND o.store_id = $2
            AND oi.status IN ('pending', 'partially_delivered')
            AND o.status != 'cancelled'
        `;
        const params = [productId, storeId];
        
        if (variant) {
            sql += ` AND oi.variant = $3`;
            params.push(variant);
        }
        
        const result = await query(sql, params);
        return parseInt(result.rows[0]?.pending_quantity || 0);
    }

    // Get pending orders for a product (to check for duplicates)
    static async getPendingOrdersForProduct(storeId, productId, variant = null) {
        // Build SQL query with proper parameter placeholders
        // Function signature: (storeId, productId, variant)
        // So params array: [storeId, productId, variant?]
        let sql = `SELECT oi.*, o.order_id as order_number, o.created_at as order_date
            FROM inventory_order_items oi
            JOIN inventory_orders o ON o.id = oi.order_id
            WHERE oi.product_id = $2 
            AND o.store_id = $1
            AND oi.status IN ('pending', 'partially_delivered')
            AND o.status != 'cancelled'`;
        
        const params = [storeId, productId];
        
        // If variant is provided, filter by exact variant match
        if (variant !== null && variant !== undefined && variant !== '') {
            sql += ` AND oi.variant = $3`;
            params.push(variant);
        }
        
        sql += ` ORDER BY o.created_at DESC`;
        
        try {
            console.log('[InventoryOrder] Executing query:', {
                sql: sql.substring(0, 200) + '...',
                params: params,
                paramCount: params.length
            });
            const result = await query(sql, params);
            console.log('[InventoryOrder] Query successful, returned', result.rows.length, 'rows');
            return result.rows;
        } catch (error) {
            console.error('[InventoryOrder] Error in getPendingOrdersForProduct:', error);
            console.error('[InventoryOrder] Error message:', error.message);
            console.error('[InventoryOrder] Error stack:', error.stack);
            console.error('[InventoryOrder] SQL:', sql);
            console.error('[InventoryOrder] Params:', params);
            console.error('[InventoryOrder] Param types:', params.map(p => typeof p));
            throw error;
        }
    }

    // Update order item quantity
    static async updateItemQuantity(itemId, quantity) {
        const result = await query(
            `UPDATE inventory_order_items 
            SET quantity = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *`,
            [parseInt(quantity), itemId]
        );
        return result.rows[0] || null;
    }

    // Remove item from order
    static async removeItem(itemId) {
        await query(
            'DELETE FROM inventory_order_items WHERE id = $1',
            [itemId]
        );
        return true;
    }

    // Mark item as delivered
    static async markItemDelivered(itemId, quantityDelivered = null) {
        const item = await query(
            'SELECT * FROM inventory_order_items WHERE id = $1',
            [itemId]
        );

        if (item.rows.length === 0) {
            throw new Error('Order item not found');
        }

        const currentItem = item.rows[0];
        const alreadyDelivered = parseInt(currentItem.quantity_delivered || 0);
        const totalQuantity = parseInt(currentItem.quantity || 0);
        const remainingQuantity = totalQuantity - alreadyDelivered;

        let deliveredQty = quantityDelivered !== null ? parseInt(quantityDelivered) : remainingQuantity;

        if (isNaN(deliveredQty) || deliveredQty <= 0) {
            throw new Error('Delivered quantity must be greater than 0');
        }

        if (remainingQuantity <= 0) {
            throw new Error('This order item has already been fully delivered');
        }

        if (deliveredQty > remainingQuantity) {
            deliveredQty = remainingQuantity;
        }

        const newDeliveredQty = alreadyDelivered + deliveredQty;

        let status = 'delivered';
        if (newDeliveredQty < currentItem.quantity) {
            status = 'partially_delivered';
        }

        const result = await query(
            `UPDATE inventory_order_items 
            SET quantity_delivered = $1, 
                status = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *`,
            [newDeliveredQty, status, itemId]
        );

        // Check if all items in order are delivered
        const orderItems = await query(
            `SELECT COUNT(*) as total, 
                   SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count
            FROM inventory_order_items
            WHERE order_id = (SELECT order_id FROM inventory_order_items WHERE id = $1)
            GROUP BY order_id`,
            [itemId]
        );

        if (orderItems.rows.length > 0) {
            const { total, delivered_count } = orderItems.rows[0];
            if (parseInt(delivered_count) === parseInt(total)) {
                // All items delivered, mark order as delivered
                await query(
                    `UPDATE inventory_orders 
                    SET status = 'delivered', 
                        delivered_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = (SELECT order_id FROM inventory_order_items WHERE id = $1)`,
                    [itemId]
                );
            }
        }

        return {
            item: result.rows[0],
            deliveredQuantity: deliveredQty,
            remainingQuantity: Math.max(totalQuantity - newDeliveredQty, 0)
        };
    }

    static async getPendingItemsForInvoice(storeId, { vendorName = null, includeAll = false } = {}) {
        let sql = `
            SELECT 
                oi.id AS order_item_id,
                o.id AS order_id,
                o.order_id AS order_number,
                o.created_at AS order_date,
                oi.product_id,
                COALESCE(p.full_product_name, oi.product_name) AS product_name,
                oi.variant,
                oi.supplier,
                oi.quantity AS quantity_ordered,
                COALESCE(oi.quantity_delivered, 0) AS quantity_delivered,
                (oi.quantity - COALESCE(oi.quantity_delivered, 0)) AS quantity_pending,
                oi.status,
                p.cost_price,
                p.quantity_per_pack,
                p.sell_price_per_piece,
                p.cost_per_unit,
                p.profit_margin,
                p.vape_tax,
                p.product_id AS product_sku
            FROM inventory_order_items oi
            JOIN inventory_orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE o.store_id = $1
              AND o.status != 'cancelled'
              AND oi.status IN ('pending', 'partially_delivered')
              AND (oi.quantity - COALESCE(oi.quantity_delivered, 0)) > 0
        `;

        const params = [storeId];
        let paramIndex = 2;

        if (!includeAll && vendorName) {
            sql += ` AND (
                COALESCE(oi.supplier, '') ILIKE $${paramIndex}
                OR COALESCE(p.supplier, '') ILIKE $${paramIndex}
            )`;
            params.push(`%${vendorName}%`);
            paramIndex++;
        }

        sql += ` ORDER BY o.created_at ASC`;

        const result = await query(sql, params);

        return result.rows.map(row => {
            const quantityOrdered = parseFloat(row.quantity_ordered || 0);
            const quantityDelivered = parseFloat(row.quantity_delivered || 0);
            const quantityPending = parseFloat(row.quantity_pending || 0);
            const costPrice = parseFloat(row.cost_price || 0);
            const quantityPerPack = parseFloat(row.quantity_per_pack || 1);
            const sellPrice = parseFloat(row.sell_price_per_piece || 0);

            const revenuePerPack = sellPrice * quantityPerPack;
            const costSubtotalPending = quantityPending * costPrice;

            return {
                order_item_id: row.order_item_id,
                order_id: row.order_id,
                order_number: row.order_number,
                order_date: row.order_date,
                product_id: row.product_id,
                product_name: row.product_name,
                product_sku: row.product_sku,
                variant: row.variant,
                supplier: row.supplier,
                quantity_ordered: quantityOrdered,
                quantity_delivered: quantityDelivered,
                quantity_pending: quantityPending,
                status: row.status,
                cost_price: costPrice,
                quantity_per_pack: quantityPerPack,
                sell_price_per_piece: sellPrice,
                cost_per_unit: parseFloat(row.cost_per_unit || 0),
                profit_margin: parseFloat(row.profit_margin || 0),
                revenue_per_pack: revenuePerPack,
                pending_cost_subtotal: costSubtotalPending,
                vape_tax: row.vape_tax || false
            };
        });
    }

    // Cancel order
    static async cancelOrder(orderId) {
        const result = await query(
            `UPDATE inventory_orders 
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *`,
            [orderId]
        );

        // Cancel all items
        await query(
            `UPDATE inventory_order_items 
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $1`,
            [orderId]
        );

        return result.rows[0] || null;
    }
}

module.exports = InventoryOrder;

