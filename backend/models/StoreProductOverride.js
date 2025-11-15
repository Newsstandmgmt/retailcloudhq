const { query } = require('../config/database');

class StoreProductOverride {
    static async listByProduct(productId) {
        if (!productId) return [];
        const result = await query(
            `SELECT spo.*, s.name AS store_name
             FROM store_product_overrides spo
             JOIN stores s ON s.id = spo.store_id
             WHERE spo.product_id = $1
             ORDER BY s.name`,
            [productId]
        );
        return result.rows;
    }

    static async getOverride(storeId, productId) {
        if (!storeId || !productId) return null;
        const result = await query(
            `SELECT * FROM store_product_overrides
             WHERE store_id = $1 AND product_id = $2`,
            [storeId, productId]
        );
        return result.rows[0] || null;
    }

    static async upsert(storeId, productId, overrideData = {}, userId = null) {
        if (!storeId || !productId) return null;
        const overrideEnabled = overrideData.override_enabled === true;
        const customSellPrice =
            overrideData.custom_sell_price !== undefined && overrideData.custom_sell_price !== null
                ? parseFloat(overrideData.custom_sell_price)
                : null;

        if (!overrideEnabled) {
            await query(
                'DELETE FROM store_product_overrides WHERE store_id = $1 AND product_id = $2',
                [storeId, productId]
            );
            return null;
        }

        if (customSellPrice === null || Number.isNaN(customSellPrice)) {
            throw new Error('Custom sell price is required when override is enabled.');
        }

        const result = await query(
            `INSERT INTO store_product_overrides (
                store_id,
                product_id,
                override_enabled,
                custom_sell_price,
                note,
                created_by,
                updated_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$6)
            ON CONFLICT (store_id, product_id) DO UPDATE SET
                override_enabled = EXCLUDED.override_enabled,
                custom_sell_price = EXCLUDED.custom_sell_price,
                note = EXCLUDED.note,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = EXCLUDED.updated_by
            RETURNING *`,
            [
                storeId,
                productId,
                true,
                customSellPrice,
                overrideData.note || null,
                userId || overrideData.updated_by || null
            ]
        );

        return result.rows[0];
    }

    static async bulkSync(productId, overrides = [], userId = null) {
        if (!productId || !Array.isArray(overrides)) {
            return [];
        }

        const normalized = overrides
            .filter(o => o && o.store_id)
            .map(o => ({
                store_id: o.store_id,
                override_enabled: o.override_enabled === true,
                custom_sell_price:
                    o.custom_sell_price !== undefined && o.custom_sell_price !== null
                        ? parseFloat(o.custom_sell_price)
                        : null,
                note: o.note || null
            }));

        const existingResult = await query(
            'SELECT store_id FROM store_product_overrides WHERE product_id = $1',
            [productId]
        );
        const existingStoreIds = new Set(existingResult.rows.map(row => row.store_id));
        const overridesMap = new Map(normalized.map(o => [o.store_id, o]));

        // Delete overrides that are no longer enabled or no longer included
        for (const storeId of existingStoreIds) {
            const override = overridesMap.get(storeId);
            if (!override || !override.override_enabled) {
                await query(
                    'DELETE FROM store_product_overrides WHERE store_id = $1 AND product_id = $2',
                    [storeId, productId]
                );
            }
        }

        const results = [];
        for (const override of normalized) {
            if (!override.override_enabled) {
                // Already deleted above if existed
                continue;
            }
            if (override.custom_sell_price === null || Number.isNaN(override.custom_sell_price)) {
                continue;
            }
            const upserted = await StoreProductOverride.upsert(
                override.store_id,
                productId,
                override,
                userId
            );
            if (upserted) {
                results.push(upserted);
            }
        }

        return results;
    }
}

module.exports = StoreProductOverride;

