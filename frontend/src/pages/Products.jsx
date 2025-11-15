import React, { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, purchaseInvoicesAPI } from '../services/api';

const defaultProductFormState = {
  product_id: '',
  category: '',
  brand: '',
  product_name: '',
  variant: '',
  variants: [],
  variants_enabled: false,
  vape_tax: false,
  cost_price: '',
  quantity_per_pack: '1',
  sell_price_per_piece: '',
  supplier: '',
  upc: '',
  notes: '',
  is_active: true,
  auto_generate_id: true,
};

const buildDefaultProductForm = () => ({ ...defaultProductFormState });

const Products = () => {
  const { selectedStore, stores } = useStore();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [vendors, setVendors] = useState([]);
  
  // Modal states for creating new category/vendor/brand
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newVendor, setNewVendor] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    notes: ''
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    supplier: '',
    search: '',
    is_active: true
  });

  // Form state
  const [formData, setFormData] = useState(buildDefaultProductForm);
  
  // Variant management state
  const [newVariant, setNewVariant] = useState({ name: '', upc: '' });
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);
  const [editingVariantData, setEditingVariantData] = useState({ name: '', upc: '' });
  const [storeOverrides, setStoreOverrides] = useState([]);
  const [originalSellPrice, setOriginalSellPrice] = useState('');
  const [overridePrompt, setOverridePrompt] = useState(null);

  const getActiveStores = () =>
    stores.filter((store) => store.is_active !== false && !store.deleted_at);

  const resetProductForm = () => {
    setFormData(buildDefaultProductForm());
    setNewVariant({ name: '', upc: '' });
    setEditingVariantIndex(null);
    setEditingVariantData({ name: '', upc: '' });
    setStoreOverrides([]);
    setOriginalSellPrice('');
  };

  const initializeStoreOverrides = (baseStoreId, existingOverrides = []) => {
    const overridesByStore = new Map(
      (existingOverrides || []).map((override) => [override.store_id, override])
    );

    const normalized = getActiveStores()
      .filter((store) => !baseStoreId || store.id !== baseStoreId)
      .map((store) => {
        const existing = overridesByStore.get(store.id);
        const price =
          existing && existing.custom_sell_price !== null && existing.custom_sell_price !== undefined
            ? parseFloat(existing.custom_sell_price).toFixed(2)
            : '';
        return {
          store_id: store.id,
          store_name: store.name,
          override_enabled: existing ? existing.override_enabled : false,
          custom_sell_price: price,
          note: existing?.note || '',
          updated_at: existing?.updated_at || null,
        };
      });

    setStoreOverrides(normalized);
  };

  const buildStoreOverridesPayload = (baseStoreId) => {
    if (!storeOverrides || storeOverrides.length === 0) return [];
    return storeOverrides
      .filter((override) => override.store_id && override.store_id !== baseStoreId)
      .map((override) => {
        const parsedPrice =
          override.override_enabled && override.custom_sell_price !== ''
            ? parseFloat(override.custom_sell_price)
            : null;
        return {
          store_id: override.store_id,
          override_enabled: override.override_enabled === true,
          custom_sell_price:
            parsedPrice !== null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
          note: override.note || null,
        };
      });
  };

  const handleOpenAddModal = () => {
    resetProductForm();
    setEditingProduct(null);
    setOverridePrompt(null);
    const baseStoreId = selectedStore?.id || null;
    initializeStoreOverrides(baseStoreId, []);
    setShowAddModal(true);
  };

  const openOverridePrompt = (storesPending, newPriceValue) => {
    const selection = {};
    storesPending.forEach((store) => {
      selection[store.store_id] = true;
    });
    setOverridePrompt({
      stores: storesPending,
      newPrice: newPriceValue,
      previousPrice: originalSellPrice || null,
      selection,
    });
  };
  
  // Calculated profit statistics
  const [profitStats, setProfitStats] = useState({
    costPerUnit: 0,
    profitPerUnit: 0,
    profitMargin: 0
  });
  
  // Bulk upload states
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [showUploadResults, setShowUploadResults] = useState(false);

  useEffect(() => {
    if (selectedStore) {
      loadProducts();
      loadCategories();
      loadBrands();
      loadSuppliers();
      loadVendors();
    }
  }, [selectedStore, filters]);

  // Calculate profit statistics when cost, quantity, or sell price changes
  useEffect(() => {
    const costPrice = parseFloat(formData.cost_price) || 0;
    const quantityPerPack = parseFloat(formData.quantity_per_pack) || 1;
    const sellPrice = parseFloat(formData.sell_price_per_piece) || 0;
    
    const costPerUnit = quantityPerPack > 0 ? costPrice / quantityPerPack : 0;
    const profitPerUnit = sellPrice - costPerUnit;
    const profitMargin = sellPrice > 0 ? (profitPerUnit / sellPrice) * 100 : 0;
    
    setProfitStats({
      costPerUnit: costPerUnit.toFixed(2),
      profitPerUnit: profitPerUnit.toFixed(2),
      profitMargin: profitMargin.toFixed(1)
    });
  }, [formData.cost_price, formData.quantity_per_pack, formData.sell_price_per_piece]);

  // Auto-generate product ID when category changes (only for new products)
  useEffect(() => {
    const generateId = async () => {
      // Only generate if: not editing, auto-generate is enabled, category is set, and store is selected
      if (!editingProduct && formData.auto_generate_id && formData.category && selectedStore) {
        try {
          const response = await productsAPI.generateProductId(selectedStore.id, formData.category);
          if (response.data && response.data.product_id) {
            setFormData(prev => {
              // Only update if the category matches (to avoid race conditions)
              if (prev.category === formData.category) {
                return { ...prev, product_id: response.data.product_id };
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('Error generating product ID:', error);
        }
      } else if (!editingProduct && !formData.auto_generate_id && formData.category) {
        // If auto-generate is disabled, clear the product_id if category changes
        setFormData(prev => ({ ...prev, product_id: '' }));
      }
    };
    
    generateId();
  }, [formData.category, formData.auto_generate_id, editingProduct, selectedStore]);

  const loadProducts = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await productsAPI.getAll(selectedStore.id, filters);
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!selectedStore) return;
    try {
      const response = await productsAPI.getCategories(selectedStore.id);
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadBrands = async () => {
    if (!selectedStore) return;
    try {
      const response = await productsAPI.getBrands(selectedStore.id);
      setBrands(response.data.brands || []);
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  };

  const loadSuppliers = async () => {
    if (!selectedStore) return;
    try {
      const response = await productsAPI.getSuppliers(selectedStore.id);
      setSuppliers(response.data.suppliers || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadVendors = async () => {
    if (!selectedStore) return;
    try {
      const response = await purchaseInvoicesAPI.getVendors(selectedStore.id);
      setVendors(response.data.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.trim()) {
      alert('Please enter a category name');
      return;
    }
    
    const trimmedCategory = newCategory.trim();
    
    // Check if category already exists
    if (categories.includes(trimmedCategory)) {
      alert('This category already exists');
      setNewCategory('');
      setShowNewCategoryModal(false);
      // Set the existing category
      setFormData({ ...formData, category: trimmedCategory });
      return;
    }
    
    // Add to local state (categories are stored in products, not a separate table)
    const updatedCategories = [...categories, trimmedCategory].sort();
    setCategories(updatedCategories);
    setFormData({ ...formData, category: trimmedCategory });
    setNewCategory('');
    setShowNewCategoryModal(false);
  };

  const handleCreateBrand = async () => {
    if (!newBrand.trim()) {
      alert('Please enter a brand name');
      return;
    }
    
    const trimmedBrand = newBrand.trim();
    
    // Check if brand already exists
    if (brands.includes(trimmedBrand)) {
      alert('This brand already exists');
      setNewBrand('');
      setShowNewBrandModal(false);
      // Set the existing brand
      setFormData({ ...formData, brand: trimmedBrand });
      return;
    }
    
    // Add to local state (brands are stored in products, not a separate table)
    const updatedBrands = [...brands, trimmedBrand].sort();
    setBrands(updatedBrands);
    setFormData({ ...formData, brand: trimmedBrand });
    setNewBrand('');
    setShowNewBrandModal(false);
  };

  const handleAddVariant = async () => {
    if (!newVariant.name || !newVariant.name.trim()) {
      alert('Please enter a variant name');
      return;
    }
    
    if (!newVariant.upc || !newVariant.upc.trim()) {
      alert('Please enter a UPC/barcode for this variant. Each variant must have a unique barcode.');
      return;
    }
    
    const trimmedName = newVariant.name.trim();
    const trimmedUPC = newVariant.upc.trim();
    
    // Check if variant name already exists
    if (formData.variants.some(v => v.name === trimmedName)) {
      alert('This variant name already exists');
      return;
    }
    
    // Check if UPC already exists in current variants
    if (formData.variants.some(v => v.upc && v.upc.toLowerCase() === trimmedUPC.toLowerCase())) {
      alert('This UPC/barcode already exists for another variant');
      return;
    }
    
    // Check if UPC already exists in database
    if (selectedStore) {
      try {
        const response = await productsAPI.getAll(selectedStore.id, { search: trimmedUPC });
        const existingProducts = response.data.products || [];
        const existingProduct = existingProducts.find(p => 
          p.upc && 
          p.upc.toLowerCase().trim() === trimmedUPC.toLowerCase().trim()
        );
        if (existingProduct) {
          alert(`This UPC/barcode already exists for product: ${existingProduct.full_product_name || existingProduct.product_name}. Each barcode must be unique.`);
          return;
        }
      } catch (error) {
        console.error('Error checking UPC uniqueness:', error);
        // Continue anyway, backend will validate
      }
    }
    
    setFormData({
      ...formData,
      variants: [...formData.variants, { name: trimmedName, upc: trimmedUPC }],
      variant: trimmedName // Set as the current variant for backward compatibility
    });
    setNewVariant({ name: '', upc: '' });
  };

  const handleEditVariant = (index) => {
    setEditingVariantIndex(index);
    setEditingVariantData({ ...formData.variants[index] });
  };

  const handleSaveVariantEdit = async () => {
    if (!editingVariantData.name || !editingVariantData.name.trim()) {
      alert('Variant name cannot be empty');
      return;
    }
    
    if (!editingVariantData.upc || !editingVariantData.upc.trim()) {
      alert('Please enter a UPC/barcode for this variant. Each variant must have a unique barcode.');
      return;
    }
    
    const trimmedName = editingVariantData.name.trim();
    const trimmedUPC = editingVariantData.upc.trim();
    
    // Check if variant name already exists (excluding current index)
    if (formData.variants.some((v, i) => i !== editingVariantIndex && v.name === trimmedName)) {
      alert('This variant name already exists');
      return;
    }
    
    // Check if UPC already exists in current variants (excluding current index)
    if (formData.variants.some((v, i) => i !== editingVariantIndex && v.upc && v.upc === trimmedUPC)) {
      alert('This UPC/barcode already exists for another variant');
      return;
    }
    
    // Check if UPC already exists in database (excluding current product if editing)
    if (selectedStore) {
      try {
        const response = await productsAPI.getAll(selectedStore.id, { search: trimmedUPC });
        const existingProducts = response.data.products || [];
        const existingProduct = existingProducts.find(p => 
          p.upc && 
          p.upc.toLowerCase() === trimmedUPC.toLowerCase() &&
          (!editingProduct || p.id !== editingProduct.id) // Exclude current product if editing
        );
        if (existingProduct) {
          alert(`This UPC/barcode already exists for product: ${existingProduct.full_product_name || existingProduct.product_name}. Each barcode must be unique.`);
          return;
        }
      } catch (error) {
        console.error('Error checking UPC uniqueness:', error);
        // Continue anyway, backend will validate
      }
    }
    
    const updatedVariants = [...formData.variants];
    updatedVariants[editingVariantIndex] = { name: trimmedName, upc: trimmedUPC };
    setFormData({
      ...formData,
      variants: updatedVariants,
      variant: trimmedName // Update current variant if it was the one being edited
    });
    setEditingVariantIndex(null);
    setEditingVariantData({ name: '', upc: '' });
  };

  const handleDeleteVariant = (index) => {
    if (!window.confirm('Are you sure you want to delete this variant?')) {
      return;
    }
    
    const updatedVariants = formData.variants.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      variants: updatedVariants,
      variant: updatedVariants.length > 0 ? updatedVariants[0].name : '' // Set first variant as current, or empty
    });
  };

  const handleCreateVendor = async () => {
    if (!newVendor.name.trim()) {
      alert('Vendor name is required');
      return;
    }
    
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }
    
    try {
      const response = await purchaseInvoicesAPI.createVendor(selectedStore.id, newVendor);
      alert('Vendor created successfully');
      // Reload vendors to get the complete list
      await loadVendors();
      // Set the newly created vendor as the supplier
      setFormData({ ...formData, supplier: response.data.vendor.name });
      setNewVendor({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        notes: ''
      });
      setShowNewVendorModal(false);
    } catch (error) {
      console.error('Error creating vendor:', error);
      alert('Failed to create vendor: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSubmit = async (e, options = {}) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const skipOverridePrompt = options.skipOverridePrompt === true;
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }

    if (!formData.product_name) {
      alert('Product name is required');
      return;
    }

    // Validate variants if enabled
    if (formData.variants_enabled) {
      if (formData.variants.length === 0) {
        alert('Please add at least one variant when variants feature is enabled. Each variant must have a unique barcode.');
        return;
      }
      
      // Validate all variants have UPCs
      const variantsWithoutUPC = formData.variants.filter(v => !v.upc || !v.upc.trim());
      if (variantsWithoutUPC.length > 0) {
        alert('All variants must have a unique UPC/barcode. Please add barcodes to all variants.');
        return;
      }
    }

    if (!skipOverridePrompt && editingProduct) {
      const previousPrice =
        originalSellPrice !== '' && originalSellPrice !== null
          ? parseFloat(originalSellPrice)
          : null;
      const newPrice =
        formData.sell_price_per_piece !== '' && formData.sell_price_per_piece !== null
          ? parseFloat(formData.sell_price_per_piece)
          : null;

      if (
        previousPrice !== null &&
        newPrice !== null &&
        !Number.isNaN(previousPrice) &&
        !Number.isNaN(newPrice) &&
        previousPrice !== newPrice
      ) {
        const overridesNeedingPrompt = storeOverrides.filter((override) => override.override_enabled);
        if (overridesNeedingPrompt.length > 0) {
          openOverridePrompt(overridesNeedingPrompt, newPrice);
          return;
        }
      }
    }

    try {
      // Get base product ID first
      let baseProductId = formData.product_id;
      if (formData.auto_generate_id && formData.category && !baseProductId && !editingProduct) {
        try {
          const idResponse = await productsAPI.generateProductId(selectedStore.id, formData.category);
          baseProductId = idResponse.data.product_id;
        } catch (error) {
          console.error('Error generating base product ID:', error);
        }
      }

      const baseStoreId = editingProduct?.store_id || selectedStore.id;

      if (formData.variants_enabled && formData.variants.length > 0) {
        // Create ONE parent product with variants stored as JSON
        const productData = {
          product_id: baseProductId || formData.product_id,
          category: formData.category,
          brand: formData.brand,
          product_name: formData.product_name,
          variant: null, // No variant for parent product
          variants_enabled: true,
          variants: formData.variants, // Store variants as JSON array
          cost_price: formData.cost_price,
          quantity_per_pack: formData.quantity_per_pack,
          sell_price_per_piece: formData.sell_price_per_piece,
          supplier: formData.supplier,
          upc: null, // Parent product doesn't have UPC (variants do)
          vape_tax: formData.vape_tax,
          notes: formData.notes,
          is_active: formData.is_active,
          auto_generate_id: editingProduct ? false : (formData.auto_generate_id && !formData.product_id),
        };
        productData.store_overrides = buildStoreOverridesPayload(baseStoreId);
        
        if (editingProduct) {
          await productsAPI.update(editingProduct.id, productData);
          alert('Product with variants updated successfully');
        } else {
          await productsAPI.create(selectedStore.id, productData);
          alert(`Successfully created product with ${formData.variants.length} variant(s)`);
        }
      } else {
        // Single product (no variants or variants disabled)
        const finalVariant = formData.variants.length > 0 ? formData.variants[0].name : formData.variant;
        
        const productData = {
          ...formData,
          variant: finalVariant,
          variants_enabled: formData.variants_enabled,
          variants: null, // No variants for single product
          auto_generate_id: editingProduct ? false : (formData.auto_generate_id && !formData.product_id)
        };
        
        // Remove variants array from the data sent to API (it's handled separately)
        delete productData.variants;
        productData.store_overrides = buildStoreOverridesPayload(baseStoreId);
        
        if (editingProduct) {
          await productsAPI.update(editingProduct.id, productData);
          alert('Product updated successfully');
        } else {
          await productsAPI.create(selectedStore.id, productData);
          alert('Product created successfully');
        }
      }
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingProduct(null);
      resetProductForm();
      setOverridePrompt(null);
      loadProducts();
      loadCategories();
      loadBrands();
      loadSuppliers();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleOverridePromptSelectionChange = (storeId) => {
    setOverridePrompt((prev) => {
      if (!prev) return prev;
      const currentSelection = prev.selection || {};
      return {
        ...prev,
        selection: {
          ...currentSelection,
          [storeId]: !currentSelection[storeId],
        },
      };
    });
  };

  const handleKeepExistingOverrides = () => {
    setOverridePrompt(null);
    handleSubmit(null, { skipOverridePrompt: true });
  };

  const handleApplyOverrideUpdates = () => {
    if (!overridePrompt) {
      return;
    }

    const selectedIds = Object.entries(overridePrompt.selection || {})
      .filter(([, isSelected]) => isSelected)
      .map(([storeId]) => storeId);

    if (selectedIds.length === 0) {
      handleKeepExistingOverrides();
      return;
    }

    setStoreOverrides((prev) =>
      prev.map((override) =>
        selectedIds.includes(override.store_id)
          ? {
              ...override,
              override_enabled: true,
              custom_sell_price: overridePrompt.newPrice?.toString() || '',
            }
          : override
      )
    );
    setOverridePrompt(null);
    handleSubmit(null, { skipOverridePrompt: true });
  };

  const handleEdit = async (productSummary) => {
    try {
      const response = await productsAPI.getById(productSummary.id);
      const product = response.data?.product;
      if (!product) {
        alert('Unable to load product details.');
        return;
      }

      setEditingProduct(product);
      setOverridePrompt(null);
      setOriginalSellPrice(product.sell_price_per_piece || '');
      initializeStoreOverrides(product.store_id, product.store_overrides || []);

      // Parse variants from JSON if it exists, otherwise use variant field for backward compatibility
      let parsedVariants = [];
      if (product.variants) {
        try {
          parsedVariants =
            typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
        } catch (e) {
          console.error('Error parsing variants:', e);
          parsedVariants = [];
        }
      } else if (product.variant && product.variants_enabled) {
        parsedVariants = [{ name: product.variant, upc: product.upc || '' }];
      } else if (product.variant) {
        parsedVariants = [{ name: product.variant, upc: product.upc || '' }];
      }

      setFormData({
        product_id: product.product_id || '',
        category: product.category || '',
        brand: product.brand || '',
        product_name: product.product_name || '',
        variant: product.variant || '',
        variants: parsedVariants,
        variants_enabled: product.variants_enabled || false,
        vape_tax: product.vape_tax || false,
        cost_price: product.cost_price || '',
        quantity_per_pack: product.quantity_per_pack || '1',
        sell_price_per_piece: product.sell_price_per_piece || '',
        supplier: product.supplier || '',
        upc: product.upc || '',
        notes: product.notes || '',
        is_active: product.is_active !== false,
        auto_generate_id: false,
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Error loading product:', error);
      alert('Failed to load product details.');
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await productsAPI.delete(productId);
      alert('Product deleted successfully');
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const resetFilters = () => {
    setFilters({
      category: '',
      brand: '',
      supplier: '',
      search: '',
      is_active: true
    });
  };

  if (!selectedStore) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  // Handle template download
  const handleDownloadTemplate = async () => {
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }
    try {
      await productsAPI.downloadTemplate(selectedStore.id);
    } catch (error) {
      alert('Failed to download template: ' + (error.message || 'Unknown error'));
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }
    
    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      alert('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
      e.target.value = ''; // Reset file input
      return;
    }
    
    setUploading(true);
    try {
      const response = await productsAPI.bulkUpload(selectedStore.id, file);
      setUploadResults(response.data);
      setShowUploadResults(true);
      // Reload products
      loadProducts();
      // Reset file input
      e.target.value = '';
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.error || error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadTemplate}
            disabled={!selectedStore}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </button>
          <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={!selectedStore || uploading}
              className="hidden"
            />
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {uploading ? 'Uploading...' : 'Bulk Upload'}
          </label>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search products..."
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <select
              value={filters.brand}
              onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Brands</option>
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <select
              value={filters.supplier}
              onChange={(e) => setFilters({ ...filters, supplier: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Suppliers</option>
              {suppliers.map(supplier => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-8">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No products found. Click "Add Product" to create your first product.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Product Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sell Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit/Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => {
                  // Parse variants if they exist
                  let productVariants = [];
                  if (product.variants) {
                    try {
                      productVariants = typeof product.variants === 'string' 
                        ? JSON.parse(product.variants) 
                        : product.variants;
                    } catch (e) {
                      productVariants = [];
                    }
                  }
                  const hasVariants = product.variants_enabled && productVariants.length > 0;
                  
                  return (
                    <React.Fragment key={product.id}>
                      <tr className={product.is_active === false ? 'bg-gray-50 opacity-75' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.product_id || '-'}
                          {hasVariants && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {productVariants.length} variant{productVariants.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {product.full_product_name || product.product_name}
                          {hasVariants && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const variantRow = document.getElementById(`variants-${product.id}`);
                                  const button = e.target;
                                  if (variantRow) {
                                    const isHidden = variantRow.classList.contains('hidden');
                                    variantRow.classList.toggle('hidden');
                                    button.textContent = isHidden ? 'Hide Variants' : 'Show Variants';
                                  }
                                }}
                                className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                Show Variants
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleEdit(product);
                                  // Open variant modal after a short delay to ensure edit modal is open
                                  setTimeout(() => {
                                    setShowVariantModal(true);
                                  }, 100);
                                }}
                                className="ml-2 text-xs text-green-600 hover:text-green-800 underline font-medium"
                                title="Edit Variant Names and UPCs"
                              >
                                Edit Variants
                              </button>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${parseFloat(product.cost_per_unit || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${parseFloat(product.sell_price_per_piece || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${parseFloat(product.profit_per_unit || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{parseFloat(product.profit_margin || 0).toFixed(1)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.supplier || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-[#2d8659] hover:text-[#256b49] mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      {hasVariants && (
                        <tr id={`variants-${product.id}`} className="hidden bg-blue-50">
                          <td colSpan="9" className="px-6 py-4">
                            <div className="space-y-2">
                              <div className="font-medium text-sm text-gray-700 mb-2">Variants:</div>
                              <div className="grid grid-cols-3 gap-4">
                                {productVariants.map((variant, idx) => (
                                  <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                                    <div className="font-medium text-sm">{variant.name || variant}</div>
                                    {variant.upc && (
                                      <div className="text-xs text-gray-500 mt-1">UPC: {variant.upc}</div>
                                    )}
                                    {!variant.upc && (
                                      <div className="text-xs text-gray-400 mt-1">No UPC assigned</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product ID/SKU
                    {!editingProduct && formData.auto_generate_id && (
                      <span className="text-xs text-gray-500 ml-2">(Auto-generated)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.product_id}
                    onChange={(e) => setFormData({ ...formData, product_id: e.target.value, auto_generate_id: false })}
                    readOnly={!editingProduct && formData.auto_generate_id}
                    className={`w-full border border-gray-300 rounded-md px-3 py-2 ${
                      !editingProduct && formData.auto_generate_id ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    placeholder={formData.auto_generate_id ? "Will be auto-generated" : "Optional"}
                  />
                  {!editingProduct && (
                    <div className="mt-1 flex items-center">
                      <input
                        type="checkbox"
                        id="auto_generate_id"
                        checked={formData.auto_generate_id}
                        onChange={(e) => {
                          setFormData({ 
                            ...formData, 
                            auto_generate_id: e.target.checked,
                            product_id: e.target.checked ? '' : formData.product_id
                          });
                        }}
                        className="rounded border-gray-300 text-[#2d8659] focus:ring-[#2d8659]"
                      />
                      <label htmlFor="auto_generate_id" className="ml-2 text-xs text-gray-600">
                        Auto-generate from category
                      </label>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    UPC/Barcode
                    {formData.variants_enabled && (
                      <span className="text-xs text-gray-500 ml-1">(Disabled - Each variant has its own barcode)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.upc}
                    onChange={(e) => setFormData({ ...formData, upc: e.target.value })}
                    disabled={formData.variants_enabled}
                    className={`w-full border border-gray-300 rounded-md px-3 py-2 ${
                      formData.variants_enabled ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    placeholder={formData.variants_enabled ? "Use variant barcodes instead" : "Optional"}
                  />
                  {formData.variants_enabled && (
                    <p className="text-xs text-gray-500 mt-1">
                      When variants are enabled, each variant must have its own unique barcode
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        if (selectedValue === '__new__') {
                          setShowNewCategoryModal(true);
                        } else {
                          setFormData({ ...formData, category: selectedValue });
                        }
                      }}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new__">+ Add New Category</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      if (selectedValue === '__new__') {
                        setShowNewBrandModal(true);
                      } else {
                        setFormData({ ...formData, brand: selectedValue });
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select Brand (Optional)</option>
                    {brands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                    <option value="__new__">+ Add New Brand</option>
                  </select>
                </div>
              </div>

              {/* Variants Enabled Toggle and Variants Option Side by Side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enable Variants Feature
                    </label>
                    <p className="text-xs text-gray-500">
                      When enabled, each variant will be created as a separate product entry with its own barcode.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={formData.variants_enabled}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          variants_enabled: e.target.checked,
                          variants: e.target.checked ? formData.variants : [] // Clear variants if disabled
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#2d8659]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d8659]"></div>
                  </label>
                </div>
                {formData.variants_enabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Variants
                      <span className="text-xs text-gray-500 ml-1">(Required - Each variant needs a unique barcode)</span>
                    </label>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowVariantModal(true)}
                        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md hover:border-[#2d8659] hover:bg-[#e8f5e9] transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                          {formData.variants.length > 0 
                            ? `Manage Variants (${formData.variants.length} added)`
                            : 'Add Variants'
                          }
                        </span>
                      </button>
                      {formData.variants.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-1">
                            <span className="font-medium">{formData.variants.length}</span> variant{formData.variants.length !== 1 ? 's' : ''} added
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {formData.variants.slice(0, 3).map((variant, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-1 rounded-md bg-white text-xs font-medium text-gray-700 border border-gray-300">
                                {variant.name || variant}
                                {variant.upc && (
                                  <span className="ml-1 text-gray-500">({variant.upc})</span>
                                )}
                              </span>
                            ))}
                            {formData.variants.length > 3 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-white text-xs font-medium text-gray-500 border border-gray-300">
                                +{formData.variants.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {formData.variants.length === 0 && (
                        <p className="text-xs text-gray-500 italic text-center">
                          Click to add variants (e.g., 12oz, 24-pack, Can, Bottle). Each variant must have a unique barcode.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {!formData.variants_enabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Variant</label>
                    <input
                      type="text"
                      value={formData.variant}
                      onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Optional (if not using variants feature)"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (per pack) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Per Pack *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity_per_pack}
                    onChange={(e) => setFormData({ ...formData, quantity_per_pack: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                    placeholder="e.g., 36"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price Per Piece *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sell_price_per_piece}
                    onChange={(e) => setFormData({ ...formData, sell_price_per_piece: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                    placeholder="e.g., 1.50"
                  />
                </div>
              </div>

              {/* Profit Statistics - Always show when cost or sell price is entered */}
              {(formData.cost_price || formData.sell_price_per_piece) && (
                <div className="bg-[#e8f5e9] border border-[#2d8659] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Profit Statistics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Cost Per Unit</label>
                      <div className="text-lg font-bold text-gray-900">
                        ${profitStats.costPerUnit}
                        {formData.quantity_per_pack && parseFloat(formData.quantity_per_pack) > 1 && formData.cost_price && (
                          <span className="text-xs text-gray-500 ml-1 block font-normal">
                            ({parseFloat(formData.cost_price).toFixed(2)} ÷ {formData.quantity_per_pack})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Profit Per Unit</label>
                      <div className={`text-lg font-bold ${parseFloat(profitStats.profitPerUnit) >= 0 ? 'text-[#2d8659]' : 'text-red-600'}`}>
                        ${profitStats.profitPerUnit}
                      </div>
                      {formData.sell_price_per_piece && profitStats.costPerUnit && (
                        <div className="text-xs text-gray-500 mt-1">
                          Sell: ${parseFloat(formData.sell_price_per_piece).toFixed(2)} - Cost: ${profitStats.costPerUnit}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Profit Margin</label>
                      <div className={`text-lg font-bold ${parseFloat(profitStats.profitMargin) >= 0 ? 'text-[#2d8659]' : 'text-red-600'}`}>
                        {profitStats.profitMargin}%
                      </div>
                      {formData.sell_price_per_piece && profitStats.profitPerUnit && (
                        <div className="text-xs text-gray-500 mt-1">
                          (${profitStats.profitPerUnit} ÷ ${parseFloat(formData.sell_price_per_piece).toFixed(2)}) × 100
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {getActiveStores().length > 1 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Store Pricing Overrides</h3>
                      <p className="text-xs text-gray-500">
                        Base sell price: {formData.sell_price_per_piece ? `$${parseFloat(formData.sell_price_per_piece).toFixed(2)}` : 'not set'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Stores without overrides will automatically use the base sell price.
                      </p>
                    </div>
                  </div>
                  {storeOverrides.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No additional stores available for overrides.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {storeOverrides.map((override) => (
                        <div
                          key={override.store_id}
                          className="border border-gray-100 rounded-lg p-3 bg-gray-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{override.store_name}</p>
                              <p className="text-xs text-gray-500">
                                {override.override_enabled && override.custom_sell_price
                                  ? `Custom price: $${parseFloat(override.custom_sell_price).toFixed(2)}`
                                  : 'Using base sell price'}
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={override.override_enabled}
                                onChange={(e) =>
                                  setStoreOverrides((prev) =>
                                    prev.map((item) =>
                                      item.store_id === override.store_id
                                        ? {
                                            ...item,
                                            override_enabled: e.target.checked,
                                            custom_sell_price:
                                              e.target.checked && !item.custom_sell_price
                                                ? formData.sell_price_per_piece || ''
                                                : item.custom_sell_price,
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#2d8659]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d8659]"></div>
                            </label>
                          </div>
                          {override.override_enabled && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Custom Sell Price
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={override.custom_sell_price}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setStoreOverrides((prev) =>
                                      prev.map((item) =>
                                        item.store_id === override.store_id
                                          ? { ...item, custom_sell_price: value }
                                          : item
                                      )
                                    );
                                  }}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                  placeholder="e.g., 1.75"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Notes (optional)
                                </label>
                                <input
                                  type="text"
                                  value={override.note || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setStoreOverrides((prev) =>
                                      prev.map((item) =>
                                        item.store_id === override.store_id
                                          ? { ...item, note: value }
                                          : item
                                      )
                                    );
                                  }}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                  placeholder="Internal note"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (Vendor)</label>
                <div className="flex gap-2">
                  <select
                    value={formData.supplier}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      if (selectedValue === '__new__') {
                        setShowNewVendorModal(true);
                      } else {
                        setFormData({ ...formData, supplier: selectedValue });
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select Supplier/Vendor</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.name}>{vendor.name}</option>
                    ))}
                    <option value="__new__">+ Add New Vendor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                />
              </div>

                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-gray-300 text-[#2d8659] focus:ring-[#2d8659]"
                      />
                      <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="vape_tax"
                        checked={formData.vape_tax}
                        onChange={(e) => setFormData({ ...formData, vape_tax: e.target.checked })}
                        className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                      />
                      <div className="ml-2 flex-1">
                        <label htmlFor="vape_tax" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Vape Tax (PA)
                        </label>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Track when this product was last purchased with vape tax paid
                        </p>
                      </div>
                    </div>
                  </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingProduct(null);
                    resetProductForm();
                    setOverridePrompt(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49]"
                >
                  {editingProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {overridePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900">Update Store Overrides?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Base sell price changed
                {overridePrompt.previousPrice
                  ? ` from $${parseFloat(overridePrompt.previousPrice || 0).toFixed(2)}`
                  : ''}
                {overridePrompt.newPrice !== undefined && overridePrompt.newPrice !== null
                  ? ` to $${parseFloat(overridePrompt.newPrice).toFixed(2)}`
                  : ''}
                .
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Select the stores whose custom price should also update.
              </p>
              <div className="mt-4 border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {overridePrompt.stores.map((store) => (
                  <label
                    key={store.store_id}
                    className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-300 text-[#2d8659] focus:ring-[#2d8659]"
                      checked={overridePrompt.selection?.[store.store_id] ?? false}
                      onChange={() => handleOverridePromptSelectionChange(store.store_id)}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{store.store_name}</p>
                      <p className="text-xs text-gray-500">
                        Current custom price:{' '}
                        {store.custom_sell_price
                          ? `$${parseFloat(store.custom_sell_price).toFixed(2)}`
                          : 'not set'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleKeepExistingOverrides}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Keep Existing
                </button>
                <button
                  type="button"
                  onClick={handleApplyOverrideUpdates}
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49]"
                >
                  Update Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add New Category</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Drinks, Snacks, Grocery"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCategoryModal(false);
                    setNewCategory('');
                    setFormData({ ...formData, category: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49]"
                >
                  Add Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Brand Modal */}
      {showNewBrandModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add New Brand</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name *</label>
                <input
                  type="text"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Pepsi, Coca-Cola, Frito-Lay"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateBrand();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewBrandModal(false);
                    setNewBrand('');
                    setFormData({ ...formData, brand: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateBrand}
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49]"
                >
                  Add Brand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variant Management Modal */}
      {showVariantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Variants</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Add, edit, or delete variants for this product (e.g., 12oz, 24-pack, Can, Bottle)
                </p>
              </div>
              <button
                onClick={() => {
                  setShowVariantModal(false);
                  setEditingVariantIndex(null);
                  setEditingVariantData({ name: '', upc: '' });
                  setNewVariant({ name: '', upc: '' });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Add Variant Section */}
              <div className="bg-[#e8f5e9] border border-[#2d8659] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Variant</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Variant Name *
                    </label>
                    <input
                      type="text"
                      value={newVariant.name}
                      onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddVariant();
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                      placeholder="e.g., 12oz, 24-pack, Can, Bottle"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      UPC/Barcode (Required for ordering platform)
                    </label>
                    <input
                      type="text"
                      value={newVariant.upc}
                      onChange={(e) => setNewVariant({ ...newVariant, upc: e.target.value })}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddVariant();
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                      placeholder="Enter unique barcode/UPC for this variant"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Each variant must have a unique barcode for accurate inventory tracking
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="w-full px-6 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49] transition-colors font-medium"
                  >
                    Add Variant
                  </button>
                </div>
              </div>

              {/* Variants List */}
              {formData.variants.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Variants ({formData.variants.length})
                  </h3>
                  <div className="space-y-2">
                    {formData.variants.map((variant, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4 hover:border-[#2d8659] hover:shadow-sm transition-all"
                      >
                        {editingVariantIndex === index ? (
                          <div className="flex-1 space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Variant Name *</label>
                              <input
                                type="text"
                                value={editingVariantData.name}
                                onChange={(e) => setEditingVariantData({ ...editingVariantData, name: e.target.value })}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveVariantEdit();
                                  } else if (e.key === 'Escape') {
                                    setEditingVariantIndex(null);
                                    setEditingVariantData({ name: '', upc: '' });
                                  }
                                }}
                                className="w-full border-2 border-[#2d8659] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">UPC/Barcode * (Required - Must be unique)</label>
                              <input
                                type="text"
                                value={editingVariantData.upc}
                                onChange={(e) => setEditingVariantData({ ...editingVariantData, upc: e.target.value })}
                                className="w-full border-2 border-[#2d8659] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                required
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Each variant must have a unique barcode. The system will check for duplicates.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleSaveVariantEdit}
                                className="flex-1 px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49] transition-colors font-medium"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVariantIndex(null);
                                  setEditingVariantData({ name: '', upc: '' });
                                }}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 rounded-full bg-[#2d8659] text-white flex items-center justify-center font-semibold text-sm">
                                {index + 1}
                              </div>
                              <div>
                                <span className="text-base font-medium text-gray-900 block">{variant.name || variant}</span>
                                {variant.upc ? (
                                  <span className="text-xs text-gray-500">UPC: {variant.upc}</span>
                                ) : (
                                  <span className="text-xs text-orange-600 italic">No UPC assigned</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditVariant(index)}
                                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium text-sm"
                              >
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVariant(index)}
                                className="px-4 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors font-medium text-sm"
                              >
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-gray-500 font-medium">No variants added yet</p>
                  <p className="text-sm text-gray-400 mt-1">Add your first variant above</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{formData.variants.length}</span> variant{formData.variants.length !== 1 ? 's' : ''} added
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowVariantModal(false);
                  setEditingVariantIndex(null);
                  setEditingVariantData({ name: '', upc: '' });
                  setNewVariant({ name: '', upc: '' });
                }}
                className="px-6 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49] transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Vendor Modal */}
      {showNewVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add New Vendor/Supplier</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateVendor(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newVendor.contact_name}
                    onChange={(e) => setNewVendor({ ...newVendor, contact_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newVendor.email}
                    onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newVendor.address}
                  onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newVendor.city}
                    onChange={(e) => setNewVendor({ ...newVendor, city: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={newVendor.state}
                    onChange={(e) => setNewVendor({ ...newVendor, state: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={newVendor.zip_code}
                    onChange={(e) => setNewVendor({ ...newVendor, zip_code: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewVendorModal(false);
                    setNewVendor({
                      name: '',
                      contact_name: '',
                      email: '',
                      phone: '',
                      address: '',
                      city: '',
                      state: '',
                      zip_code: '',
                      notes: ''
                    });
                    setFormData({ ...formData, supplier: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49]"
                >
                  Create Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Results Modal */}
      {showUploadResults && uploadResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Bulk Upload Results</h2>
                <button
                  onClick={() => {
                    setShowUploadResults(false);
                    setUploadResults(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 font-medium">{uploadResults.message}</p>
                <p className="text-sm text-blue-600 mt-1">
                  Total rows: {uploadResults.results?.total || 0} | 
                  Successful: {uploadResults.results?.success?.length || 0} | 
                  Errors: {uploadResults.results?.errors?.length || 0}
                </p>
              </div>

              {uploadResults.results?.success && uploadResults.results.success.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-green-700 mb-2">
                    Successfully Created ({uploadResults.results.success.length})
                  </h3>
                  <div className="max-h-48 overflow-y-auto border border-green-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-green-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Product Name</th>
                          <th className="px-3 py-2 text-left">Product ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResults.results.success.map((item, idx) => (
                          <tr key={idx} className="border-t border-green-100">
                            <td className="px-3 py-2">{item.row}</td>
                            <td className="px-3 py-2">{item.product_name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{item.product_id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {uploadResults.results?.errors && uploadResults.results.errors.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-red-700 mb-2">
                    Errors ({uploadResults.results.errors.length})
                  </h3>
                  <div className="max-h-48 overflow-y-auto border border-red-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResults.results.errors.map((item, idx) => (
                          <tr key={idx} className="border-t border-red-100">
                            <td className="px-3 py-2 font-medium">{item.row}</td>
                            <td className="px-3 py-2 text-red-700">{item.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowUploadResults(false);
                    setUploadResults(null);
                  }}
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;

