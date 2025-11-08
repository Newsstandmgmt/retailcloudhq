const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Product = require('../models/Product');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Configure multer for Excel file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow Excel files
        const allowedTypes = /xlsx|xls/;
        const extname = allowedTypes.test(file.originalname.split('.').pop().toLowerCase());
        const mimetype = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                         file.mimetype === 'application/vnd.ms-excel' ||
                         file.mimetype === 'application/octet-stream';
        
        if (extname || mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'));
        }
    }
});

// Get all products for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const { category, brand, supplier, search, is_active } = req.query;
        const filters = {};
        
        if (category) filters.category = category;
        if (brand) filters.brand = brand;
        if (supplier) filters.supplier = supplier;
        if (search) filters.search = search;
        if (is_active !== undefined) filters.is_active = is_active === 'true';

        const products = await Product.findByStore(req.params.storeId, filters);
        res.json({ products });
    } catch (error) {
        console.error('Get products error:', error);
        console.error('Error stack:', error.stack);
        // Check if it's a table doesn't exist error
        if (error.message && error.message.includes('does not exist')) {
            res.status(500).json({ 
                error: 'Products table does not exist. Please run the database migration: backend/config/products-schema.sql',
                details: error.message 
            });
        } else {
            res.status(500).json({ error: 'Failed to fetch products', details: error.message });
        }
    }
});

// Get product by ID
router.get('/:productId', async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, product.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }
        
        res.json({ product });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Generate product ID preview
router.get('/store/:storeId/generate-id', canAccessStore, async (req, res) => {
    try {
        const { category } = req.query;
        if (!category) {
            return res.status(400).json({ error: 'Category is required' });
        }
        const productId = await Product.generateProductId(req.params.storeId, category);
        res.json({ product_id: productId });
    } catch (error) {
        console.error('Generate product ID error:', error);
        res.status(500).json({ error: 'Failed to generate product ID' });
    }
});

// Create product
router.post('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const productData = {
            ...req.body,
            created_by: req.user.id
        };

        if (!productData.product_name) {
            return res.status(400).json({ error: 'Product name is required' });
        }

        const product = await Product.create(req.params.storeId, productData);
        res.status(201).json({ product });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
router.put('/:productId', async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, product.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updatedProduct = await Product.update(req.params.productId, req.body);
        if (!updatedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ product: updatedProduct });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product
router.delete('/:productId', async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, product.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        await Product.delete(req.params.productId);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Get categories for a store
router.get('/store/:storeId/categories', canAccessStore, async (req, res) => {
    try {
        const categories = await Product.getCategories(req.params.storeId);
        res.json({ categories });
    } catch (error) {
        console.error('Get categories error:', error);
        console.error('Error stack:', error.stack);
        if (error.message && error.message.includes('does not exist')) {
            res.status(500).json({ 
                error: 'Products table does not exist. Please run the database migration: backend/config/products-schema.sql',
                details: error.message 
            });
        } else {
            res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
        }
    }
});

// Get brands for a store
router.get('/store/:storeId/brands', canAccessStore, async (req, res) => {
    try {
        const brands = await Product.getBrands(req.params.storeId);
        res.json({ brands });
    } catch (error) {
        console.error('Get brands error:', error);
        console.error('Error stack:', error.stack);
        if (error.message && error.message.includes('does not exist')) {
            res.status(500).json({ 
                error: 'Products table does not exist. Please run the database migration: backend/config/products-schema.sql',
                details: error.message 
            });
        } else {
            res.status(500).json({ error: 'Failed to fetch brands', details: error.message });
        }
    }
});

// Get suppliers for a store
router.get('/store/:storeId/suppliers', canAccessStore, async (req, res) => {
    try {
        const suppliers = await Product.getSuppliers(req.params.storeId);
        res.json({ suppliers });
    } catch (error) {
        console.error('Get suppliers error:', error);
        console.error('Error stack:', error.stack);
        if (error.message && error.message.includes('does not exist')) {
            res.status(500).json({ 
                error: 'Products table does not exist. Please run the database migration: backend/config/products-schema.sql',
                details: error.message 
            });
        } else {
            res.status(500).json({ error: 'Failed to fetch suppliers', details: error.message });
        }
    }
});

// Calculate expected revenue for selected products
router.post('/store/:storeId/calculate-revenue', canAccessStore, async (req, res) => {
    try {
        const { items } = req.body; // Array of { product_id, quantity }
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items array is required' });
        }

        const expectedRevenue = await Product.calculateExpectedRevenue(req.params.storeId, items);
        res.json({ expected_revenue: expectedRevenue });
    } catch (error) {
        console.error('Calculate revenue error:', error);
        res.status(500).json({ error: 'Failed to calculate expected revenue' });
    }
});

// Download Excel template for bulk upload
router.get('/store/:storeId/template', canAccessStore, async (req, res) => {
    try {
        // Create template workbook
        const workbook = XLSX.utils.book_new();
        
        // Define template headers
        const headers = [
            'Product ID (Optional - leave blank to auto-generate)',
            'Category *',
            'Brand',
            'Product Name *',
            'Variant',
            'Cost Price *',
            'Quantity Per Pack *',
            'Sell Price Per Piece *',
            'Supplier',
            'UPC/Barcode',
            'Vape Tax (Yes/No)',
            'Notes',
            'Is Active (Yes/No)'
        ];
        
        // Create sample data row
        const sampleData = [
            [
                '', // Product ID - leave blank for auto-generation
                'Drinks', // Category
                'Coca-Cola', // Brand
                'Coca-Cola Classic', // Product Name
                '12oz Can', // Variant
                '24.00', // Cost Price
                '24', // Quantity Per Pack
                '1.50', // Sell Price Per Piece
                'Coca-Cola Distributor', // Supplier
                '049000028911', // UPC/Barcode
                'No', // Vape Tax
                'Sample product', // Notes
                'Yes' // Is Active
            ]
        ];
        
        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        
        // Set column widths
        worksheet['!cols'] = [
            { wch: 30 }, // Product ID
            { wch: 20 }, // Category
            { wch: 20 }, // Brand
            { wch: 25 }, // Product Name
            { wch: 20 }, // Variant
            { wch: 15 }, // Cost Price
            { wch: 18 }, // Quantity Per Pack
            { wch: 20 }, // Sell Price Per Piece
            { wch: 25 }, // Supplier
            { wch: 20 }, // UPC/Barcode
            { wch: 15 }, // Vape Tax
            { wch: 30 }, // Notes
            { wch: 15 }  // Is Active
        ];
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        
        // Generate Excel file buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="product-upload-template.xlsx"`);
        
        // Send file
        res.send(excelBuffer);
    } catch (error) {
        console.error('Download template error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Bulk upload products from Excel file
router.post('/store/:storeId/bulk-upload', canAccessStore, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const storeId = req.params.storeId;
        const userId = req.user.id;
        
        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '' // Default value for empty cells
        });
        
        if (data.length < 2) {
            return res.status(400).json({ error: 'Excel file must contain at least a header row and one data row' });
        }
        
        // Extract headers (first row)
        const headers = data[0].map(h => String(h).trim());
        
        // Find column indices
        const getColumnIndex = (name) => {
            const index = headers.findIndex(h => 
                h.toLowerCase().includes(name.toLowerCase())
            );
            return index >= 0 ? index : null;
        };
        
        const categoryIdx = getColumnIndex('category');
        const brandIdx = getColumnIndex('brand');
        const productNameIdx = getColumnIndex('product name');
        const variantIdx = getColumnIndex('variant');
        const costPriceIdx = getColumnIndex('cost price');
        const quantityPerPackIdx = getColumnIndex('quantity per pack');
        const sellPriceIdx = getColumnIndex('sell price');
        const supplierIdx = getColumnIndex('supplier');
        const upcIdx = getColumnIndex('upc') || getColumnIndex('barcode');
        const vapeTaxIdx = getColumnIndex('vape tax');
        const notesIdx = getColumnIndex('notes');
        const isActiveIdx = getColumnIndex('is active');
        const productIdIdx = getColumnIndex('product id');
        
        // Validate required columns
        if (categoryIdx === null || productNameIdx === null || costPriceIdx === null || 
            quantityPerPackIdx === null || sellPriceIdx === null) {
            return res.status(400).json({ 
                error: 'Missing required columns: Category, Product Name, Cost Price, Quantity Per Pack, and Sell Price Per Piece are required' 
            });
        }
        
        // Process rows (skip header row)
        const results = {
            success: [],
            errors: [],
            total: data.length - 1
        };
        
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 1;
            
            try {
                // Extract values
                const category = row[categoryIdx] ? String(row[categoryIdx]).trim() : '';
                const productName = row[productNameIdx] ? String(row[productNameIdx]).trim() : '';
                const brand = brandIdx !== null && row[brandIdx] ? String(row[brandIdx]).trim() : '';
                const variant = variantIdx !== null && row[variantIdx] ? String(row[variantIdx]).trim() : '';
                const costPrice = row[costPriceIdx] ? parseFloat(String(row[costPriceIdx]).replace(/[^0-9.-]/g, '')) : 0;
                const quantityPerPack = quantityPerPackIdx !== null && row[quantityPerPackIdx] ? 
                    parseInt(String(row[quantityPerPackIdx]).replace(/[^0-9]/g, '')) : 1;
                const sellPrice = row[sellPriceIdx] ? parseFloat(String(row[sellPriceIdx]).replace(/[^0-9.-]/g, '')) : 0;
                const supplier = supplierIdx !== null && row[supplierIdx] ? String(row[supplierIdx]).trim() : '';
                const upc = upcIdx !== null && row[upcIdx] ? String(row[upcIdx]).trim() : '';
                const vapeTax = vapeTaxIdx !== null && row[vapeTaxIdx] ? 
                    String(row[vapeTaxIdx]).toLowerCase().trim() === 'yes' : false;
                const notes = notesIdx !== null && row[notesIdx] ? String(row[notesIdx]).trim() : '';
                const isActive = isActiveIdx !== null && row[isActiveIdx] ? 
                    String(row[isActiveIdx]).toLowerCase().trim() === 'yes' : true;
                const productId = productIdIdx !== null && row[productIdIdx] ? String(row[productIdIdx]).trim() : '';
                
                // Validate required fields
                if (!category) {
                    results.errors.push({ row: rowNum, error: 'Category is required' });
                    continue;
                }
                if (!productName) {
                    results.errors.push({ row: rowNum, error: 'Product Name is required' });
                    continue;
                }
                if (isNaN(costPrice) || costPrice <= 0) {
                    results.errors.push({ row: rowNum, error: 'Cost Price must be a positive number' });
                    continue;
                }
                if (isNaN(quantityPerPack) || quantityPerPack <= 0) {
                    results.errors.push({ row: rowNum, error: 'Quantity Per Pack must be a positive number' });
                    continue;
                }
                if (isNaN(sellPrice) || sellPrice <= 0) {
                    results.errors.push({ row: rowNum, error: 'Sell Price Per Piece must be a positive number' });
                    continue;
                }
                
                // Prepare product data
                const productData = {
                    product_id: productId || undefined, // Will be auto-generated if not provided
                    category,
                    brand: brand || undefined,
                    product_name: productName,
                    variant: variant || undefined,
                    cost_price: costPrice,
                    quantity_per_pack: quantityPerPack,
                    sell_price_per_piece: sellPrice,
                    supplier: supplier || undefined,
                    upc: upc || undefined,
                    vape_tax: vapeTax,
                    notes: notes || undefined,
                    is_active: isActive,
                    auto_generate_id: !productId, // Auto-generate if product_id not provided
                    created_by: userId
                };
                
                // Create product
                const product = await Product.create(storeId, productData);
                results.success.push({ row: rowNum, product_id: product.id, product_name: productName });
                
            } catch (error) {
                console.error(`Error processing row ${rowNum}:`, error);
                results.errors.push({ 
                    row: rowNum, 
                    error: error.message || 'Failed to create product' 
                });
            }
        }
        
        res.json({
            message: `Bulk upload completed: ${results.success.length} successful, ${results.errors.length} errors`,
            results
        });
        
    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({ error: 'Failed to process bulk upload', details: error.message });
    }
});

module.exports = router;

