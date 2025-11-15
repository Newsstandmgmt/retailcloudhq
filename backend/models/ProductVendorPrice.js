const { query } = require('../config/database');

class ProductVendorPrice {
    static async listByProduct(productId) {
        if (!productId) return [];
        const result = await query(
            `SELECT pvp.*, v.name AS vendor_name
             FROM product_vendor_prices pvp
             JOIN vendors v ON v.id = pvp.vendor_id
             WHERE pvp.product_id = $1
             ORDER BY v.name`,
            [productId]
        );
        return result.rows;
    }

    static async listByStore(storeId, vendorId = null) {
        if (!storeId) return [];
        const params = [storeId];
        let whereClause = 'pr.store_id = $1';
        if (vendorId) {
            params.push(vendorId);
            whereClause += ` AND pvp.vendor_id = $${params.length}`;
        }
        const result = await query(
            `SELECT 
                pvp.*,
                v.name AS vendor_name,
                pr.id AS product_id,
                pr.product_name,
                pr.full_product_name
             FROM product_vendor_prices pvp
             JOIN products pr ON pr.id = pvp.product_id
             JOIN vendors v ON v.id = pvp.vendor_id
             WHERE ${whereClause}
             ORDER BY v.name, pr.product_name`,
            params
        );
        return result.rows;
    }

    static async listHistory(productId) {
        if (!productId) return [];
        const result = await query(
            `SELECT h.*, v.name AS vendor_name, u.first_name, u.last_name
             FROM product_vendor_price_history h
             JOIN vendors v ON v.id = h.vendor_id
             LEFT JOIN users u ON u.id = h.changed_by
             WHERE h.product_id = $1
             ORDER BY h.changed_at DESC`,
            [productId]
        );
        return result.rows;
    }

    static async recordHistory(priceRow, newCost, userId, reason = null) {
        if (!priceRow) return;
        await query(
            `INSERT INTO product_vendor_price_history (
                product_vendor_price_id,
                product_id,
                vendor_id,
                previous_cost_price,
                new_cost_price,
                change_reason,
                changed_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
                priceRow.id || null,
                priceRow.product_id,
                priceRow.vendor_id,
                priceRow.cost_price !== undefined ? priceRow.cost_price : priceRow.previous_cost_price || null,
                newCost,
                reason || null,
                userId || null
            ]
        );
    }

    static async upsert(productId, vendorId, payload = {}, userId = null) {
        if (!productId || !vendorId) return null;
        const costPrice =
            payload.cost_price !== undefined && payload.cost_price !== null
                ? parseFloat(payload.cost_price)
                : null;
        if (costPrice === null || Number.isNaN(costPrice)) {
            throw new Error('Cost price is required for vendor pricing.');
        }
        const effectiveFrom = payload.effective_from || new Date().toISOString().split('T')[0];
        const notes = payload.notes || null;

        const existing = await query(
            `SELECT * FROM product_vendor_prices 
             WHERE product_id = $1 AND vendor_id = $2`,
            [productId, vendorId]
        );
        let historyRow = null;
        if (existing.rows.length > 0) {
            const current = existing.rows[0];
            if (parseFloat(current.cost_price) !== costPrice || current.effective_from !== effectiveFrom || current.notes !== notes) {
                await query(
                    `UPDATE product_vendor_prices
                     SET cost_price = $1,
                         effective_from = $2,
                         notes = $3,
                         updated_at = CURRENT_TIMESTAMP,
                         updated_by = $4
                     WHERE id = $5`,
                    [costPrice, effectiveFrom, notes, userId || payload.updated_by || null, current.id]
                );
                historyRow = current;
            }
        } else {
            const inserted = await query(
                `INSERT INTO product_vendor_prices (
                    product_id,
                    vendor_id,
                    cost_price,
                    effective_from,
                    notes,
                    created_by,
                    updated_by
                ) VALUES ($1,$2,$3,$4,$5,$6,$6)
                RETURNING *`,
                [productId, vendorId, costPrice, effectiveFrom, notes, userId || payload.created_by || null]
            );
            historyRow = inserted.rows[0];
        }

        if (historyRow) {
            await ProductVendorPrice.recordHistory(
                { ...historyRow, previous_cost_price: historyRow.cost_price },
                costPrice,
                userId,
                payload.change_reason || null
            );
        }

        const refreshed = await query(
            `SELECT pvp.*, v.name AS vendor_name
             FROM product_vendor_prices pvp
             JOIN vendors v ON v.id = pvp.vendor_id
             WHERE pvp.product_id = $1 AND pvp.vendor_id = $2`,
            [productId, vendorId]
        );
        return refreshed.rows[0] || null;
    }

    static async bulkSync(productId, entries = [], userId = null) {
        if (!productId || !Array.isArray(entries)) {
            return [];
        }

        const normalized = entries
            .filter((entry) => entry && entry.vendor_id)
            .map((entry) => ({
                vendor_id: entry.vendor_id,
                cost_price:
                    entry.cost_price !== undefined && entry.cost_price !== null
                        ? parseFloat(entry.cost_price)
                        : null,
                effective_from: entry.effective_from || new Date().toISOString().split('T')[0],
                notes: entry.notes || null,
                change_reason: entry.change_reason || null,
            }))
            .filter((entry) => entry.cost_price !== null && !Number.isNaN(entry.cost_price));

        const existingResult = await query(
            'SELECT id, vendor_id, cost_price FROM product_vendor_prices WHERE product_id = $1',
            [productId]
        );
        const existingMap = new Map(existingResult.rows.map((row) => [row.vendor_id, row]));

        const vendorIdsInPayload = new Set(normalized.map((entry) => entry.vendor_id));
        // Delete vendor prices not provided
        for (const existingVendorId of existingMap.keys()) {
            if (!vendorIdsInPayload.has(existingVendorId)) {
                await query('DELETE FROM product_vendor_prices WHERE product_id = $1 AND vendor_id = $2', [
                    productId,
                    existingVendorId,
                ]);
            }
        }

        const results = [];
        for (const entry of normalized) {
            const upserted = await ProductVendorPrice.upsert(
                productId,
                entry.vendor_id,
                entry,
                userId
            );
            if (upserted) {
                results.push(upserted);
            }
        }

        return results;
    }
}

module.exports = ProductVendorPrice;

