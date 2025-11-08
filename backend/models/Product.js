const { query } = require('../config/database');

class Product {
    constructor(data) {
        Object.assign(this, data);
    }

    // Generate product ID based on category
    static async generateProductId(storeId, category) {
        if (!category) {
            return null;
        }

        // Get first 3 letters of category, uppercase
        const categoryPrefix = category.substring(0, 3).toUpperCase().padEnd(3, 'X');

        // Find the highest existing product_id for this category
        const result = await query(
            `SELECT product_id 
            FROM products 
            WHERE store_id = $1 
            AND category = $2 
            AND product_id LIKE $3 
            AND deleted_at IS NULL
            ORDER BY product_id DESC 
            LIMIT 1`,
            [storeId, category, `${categoryPrefix}%`]
        );

        let nextNumber = 1;
        if (result.rows.length > 0 && result.rows[0].product_id) {
            const lastId = result.rows[0].product_id;
            // Extract number from last ID (e.g., DRI001 -> 1)
            const match = lastId.match(/\d+$/);
            if (match) {
                nextNumber = parseInt(match[0]) + 1;
            }
        }

        // Format as CAT001, CAT002, etc.
        return `${categoryPrefix}${String(nextNumber).padStart(3, '0')}`;
    }

    // Create a new product
    static async create(storeId, productData) {
        const {
            product_id,
            category,
            brand,
            product_name,
            variant,
            cost_price,
            quantity_per_pack,
            sell_price_per_piece,
            supplier,
            upc,
            notes,
            vape_tax,
            variants,
            created_by,
            auto_generate_id
        } = productData;

        // Auto-generate product_id if requested and category is provided
        let finalProductId = product_id;
        if (auto_generate_id && !product_id && category) {
            finalProductId = await this.generateProductId(storeId, category);
        }

        // Check if UPC is unique (if provided)
        if (upc && upc.trim()) {
            const upcCheck = await query(
                'SELECT id FROM products WHERE store_id = $1 AND UPPER(TRIM(upc)) = UPPER(TRIM($2)) AND deleted_at IS NULL',
                [storeId, upc.trim()]
            );
            if (upcCheck.rows.length > 0) {
                throw new Error(`UPC/Barcode "${upc.trim()}" already exists for another product. Each barcode must be unique.`);
            }
        }

        // Check if variants_enabled column exists
        const columnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name = 'variants_enabled'
        `);
        const hasVariantsEnabled = columnCheck.rows.length > 0;
        
        const variantsEnabled = productData.variants_enabled || false;
        
        // Check if vape_tax column exists
        const vapeTaxColumnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name = 'vape_tax'
        `);
        const hasVapeTax = vapeTaxColumnCheck.rows.length > 0;
        const vapeTaxValue = vape_tax || false;

        // Check if variants column exists
        const variantsColumnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name = 'variants'
        `);
        const hasVariantsColumn = variantsColumnCheck.rows.length > 0;
        const variantsJson = variants && Array.isArray(variants) ? JSON.stringify(variants) : null;

        // Build dynamic query based on available columns
        let columns = ['store_id', 'product_id', 'category', 'brand', 'product_name', 'variant', 'cost_price', 'quantity_per_pack', 'sell_price_per_piece', 'supplier', 'upc', 'notes', 'created_by'];
        let values = [storeId, finalProductId || null, category || null, brand || null, product_name, variant || null, parseFloat(cost_price) || 0, parseInt(quantity_per_pack) || 1, parseFloat(sell_price_per_piece) || 0, supplier || null, upc || null, notes || null, created_by || null];
        let placeholders = [];
        
        if (hasVariantsEnabled) {
            columns.push('variants_enabled');
            values.push(variantsEnabled);
        }
        
        if (hasVapeTax) {
            columns.push('vape_tax');
            values.push(vapeTaxValue);
        }
        
        if (hasVariantsColumn) {
            columns.push('variants');
            values.push(variantsJson);
        }

        for (let i = 1; i <= values.length; i++) {
            placeholders.push(`$${i}`);
        }

        const result = await query(
            `INSERT INTO products (${columns.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING *`,
            values
        );
        return new Product(result.rows[0]);
    }

    // Get all products for a store
    static async findByStore(storeId, filters = {}) {
        let sql = `
            SELECT * FROM products 
            WHERE store_id = $1 AND deleted_at IS NULL
        `;
        const params = [storeId];
        let paramIndex = 2;

        // Apply filters
        if (filters.category) {
            sql += ` AND category = $${paramIndex}`;
            params.push(filters.category);
            paramIndex++;
        }

        if (filters.brand) {
            sql += ` AND brand = $${paramIndex}`;
            params.push(filters.brand);
            paramIndex++;
        }

        if (filters.supplier) {
            sql += ` AND supplier = $${paramIndex}`;
            params.push(filters.supplier);
            paramIndex++;
        }

        if (filters.search) {
            sql += ` AND (
                product_name ILIKE $${paramIndex} OR
                brand ILIKE $${paramIndex} OR
                category ILIKE $${paramIndex} OR
                product_id ILIKE $${paramIndex} OR
                upc ILIKE $${paramIndex} OR
                full_product_name ILIKE $${paramIndex}
            )`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        if (filters.is_active !== undefined) {
            sql += ` AND is_active = $${paramIndex}`;
            params.push(filters.is_active);
            paramIndex++;
        }

        sql += ` ORDER BY category, brand, product_name, variant`;

        const result = await query(sql, params);
        return result.rows.map(row => new Product(row));
    }

    // Get product by ID
    static async findById(productId) {
        const result = await query(
            'SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL',
            [productId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return new Product(result.rows[0]);
    }

    // Update product
    static async update(productId, productData) {
        const {
            product_id,
            category,
            brand,
            product_name,
            variant,
            cost_price,
            quantity_per_pack,
            sell_price_per_piece,
            supplier,
            upc,
            is_active,
            vape_tax,
            variants,
            variants_enabled,
            notes
        } = productData;

        // Get current product to check store_id
        const currentProduct = await this.findById(productId);
        if (!currentProduct) {
            return null;
        }

        // Check if UPC is unique (if provided and changed)
        if (upc && upc.trim()) {
            const upcCheck = await query(
                'SELECT id FROM products WHERE store_id = $1 AND UPPER(TRIM(upc)) = UPPER(TRIM($2)) AND id != $3 AND deleted_at IS NULL',
                [currentProduct.store_id, upc.trim(), productId]
            );
            if (upcCheck.rows.length > 0) {
                throw new Error(`UPC/Barcode "${upc.trim()}" already exists for another product. Each barcode must be unique.`);
            }
        }

        // Check if vape_tax column exists
        const vapeTaxColumnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name = 'vape_tax'
        `);
        const hasVapeTax = vapeTaxColumnCheck.rows.length > 0;

        // Check if variants column exists
        const variantsColumnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name = 'variants'
        `);
        const hasVariantsColumn = variantsColumnCheck.rows.length > 0;
        const variantsJson = variants && Array.isArray(variants) ? JSON.stringify(variants) : null;

        // Check if variants_enabled column exists
        const variantsEnabledColumnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name = 'variants_enabled'
        `);
        const hasVariantsEnabled = variantsEnabledColumnCheck.rows.length > 0;

        // Build dynamic UPDATE query
        let updateFields = [
            'product_id = COALESCE($1, product_id)',
            'category = COALESCE($2, category)',
            'brand = COALESCE($3, brand)',
            'product_name = COALESCE($4, product_name)',
            'variant = COALESCE($5, variant)',
            'cost_price = COALESCE($6, cost_price)',
            'quantity_per_pack = COALESCE($7, quantity_per_pack)',
            'sell_price_per_piece = COALESCE($8, sell_price_per_piece)',
            'supplier = COALESCE($9, supplier)',
            'upc = COALESCE($10, upc)',
            'is_active = COALESCE($11, is_active)',
            'notes = COALESCE($12, notes)',
            'updated_at = CURRENT_TIMESTAMP'
        ];
        let values = [
            product_id,
            category,
            brand,
            product_name,
            variant,
            cost_price ? parseFloat(cost_price) : null,
            quantity_per_pack ? parseInt(quantity_per_pack) : null,
            sell_price_per_piece ? parseFloat(sell_price_per_piece) : null,
            supplier,
            upc,
            is_active,
            notes
        ];
        
        if (hasVariantsEnabled) {
            updateFields.push('variants_enabled = COALESCE($' + (values.length + 1) + ', variants_enabled)');
            values.push(variants_enabled);
        }
        
        if (hasVapeTax) {
            updateFields.push('vape_tax = COALESCE($' + (values.length + 1) + ', vape_tax)');
            values.push(vape_tax);
        }
        
        if (hasVariantsColumn) {
            updateFields.push('variants = $' + (values.length + 1));
            values.push(variantsJson);
        }
        
        values.push(productId); // For WHERE clause

        const result = await query(
            `UPDATE products SET ${updateFields.join(', ')}
            WHERE id = $${values.length} AND deleted_at IS NULL
            RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return null;
        }

        return new Product(result.rows[0]);
    }

    // Delete product (soft delete)
    static async delete(productId) {
        const result = await query(
            'UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [productId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return new Product(result.rows[0]);
    }

    // Get distinct categories for a store
    static async getCategories(storeId) {
        const result = await query(
            `SELECT DISTINCT category 
            FROM products 
            WHERE store_id = $1 AND deleted_at IS NULL AND category IS NOT NULL AND category != ''
            ORDER BY category`,
            [storeId]
        );

        return result.rows.map(row => row.category);
    }

    // Get distinct brands for a store
    static async getBrands(storeId) {
        const result = await query(
            `SELECT DISTINCT brand 
            FROM products 
            WHERE store_id = $1 AND deleted_at IS NULL AND brand IS NOT NULL AND brand != ''
            ORDER BY brand`,
            [storeId]
        );

        return result.rows.map(row => row.brand);
    }

    // Get distinct suppliers for a store
    static async getSuppliers(storeId) {
        const result = await query(
            `SELECT DISTINCT supplier 
            FROM products 
            WHERE store_id = $1 AND deleted_at IS NULL AND supplier IS NOT NULL AND supplier != ''
            ORDER BY supplier`,
            [storeId]
        );

        return result.rows.map(row => row.supplier);
    }

    // Calculate expected revenue for a list of products with quantities
    static async calculateExpectedRevenue(storeId, items) {
        // items should be an array of { product_id, quantity }
        if (!Array.isArray(items) || items.length === 0) {
            return 0;
        }

        const productIds = items.map(item => item.product_id || item.id).filter(Boolean);
        if (productIds.length === 0) {
            return 0;
        }

        const result = await query(
            `SELECT id, sell_price_per_piece, quantity_per_pack 
            FROM products 
            WHERE id = ANY($1::uuid[]) AND store_id = $2 AND deleted_at IS NULL AND is_active = true`,
            [productIds, storeId]
        );

        const productsMap = {};
        result.rows.forEach(row => {
            productsMap[row.id] = {
                sell_price_per_piece: parseFloat(row.sell_price_per_piece) || 0,
                quantity_per_pack: parseInt(row.quantity_per_pack) || 1
            };
        });

        let totalRevenue = 0;
        items.forEach(item => {
            const productId = item.product_id || item.id;
            const quantity = parseFloat(item.quantity) || 0; // Quantity of packs
            const product = productsMap[productId];
            if (product) {
                // Revenue = sell_price_per_piece * quantity_per_pack * quantity (of packs)
                const packRevenue = product.sell_price_per_piece * product.quantity_per_pack;
                totalRevenue += packRevenue * quantity;
            }
        });

        return totalRevenue;
    }
}

module.exports = Product;

