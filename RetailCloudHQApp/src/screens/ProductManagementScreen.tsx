import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { productsAPI } from '../api/productsAPI';
import { deviceAuthAPI } from '../api/deviceAuthAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Database from '../services/database';
import SyncService from '../services/syncService';

// Import NetInfo with error handling
let NetInfo: any;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (error) {
  console.warn('[ProductManagement] NetInfo not available, using fallback');
  NetInfo = {
    fetch: async () => ({ isConnected: true }),
    addEventListener: () => () => {},
  };
}

interface Product {
  id: string;
  product_id: string;
  product_name: string;
  variant: string | null;
  full_product_name: string;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  upc: string | null;
  cost_price: number;
  sell_price_per_piece: number;
  quantity_per_pack: number;
  cost_per_unit: number;
  profit_per_unit: number;
  profit_margin: number;
  variants_enabled?: boolean;
  variants?: any; // JSON array of variant objects
}

interface Variant {
  name: string;
  upc: string;
}

export default function ProductManagementScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('employee');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    product_name: '',
    category: '',
    brand: '',
    supplier: '',
    cost_price: '',
    sell_price_per_piece: '',
    quantity_per_pack: '1',
    upc: '',
    vape_tax: false,
  });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [newVariant, setNewVariant] = useState<Variant>({ name: '', upc: '' });
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<any>(null);

  const canEdit = userRole === 'admin' || userRole === 'super_admin' || userRole === 'manager';

  useEffect(() => {
    loadData();
    setupNetworkListener();
    setupSyncStatusListener();
  }, []);

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected || false);
    });
    return unsubscribe;
  };

  const setupSyncStatusListener = () => {
    const unsubscribe = SyncService.subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  };

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      const user = await deviceAuthAPI.getCurrentUser();
      const storedStoreId = await AsyncStorage.getItem('store_id');
      const storedRole = await AsyncStorage.getItem('user_role');
      
      if (!user?.store_id && !storedStoreId) {
        Alert.alert(
          'No Store Selected',
          'No store ID found. Please log in again or contact your administrator.',
          [
            {
              text: 'OK',
              onPress: () => navigation?.goBack(),
            },
          ]
        );
        setLoading(false);
        return;
      }

      const storeIdToUse = user?.store_id || storedStoreId;
      setStoreId(storeIdToUse);
      setUserRole(user?.role || storedRole || 'employee');

      // Simple API-first approach (original working flow)
      const [productsData, categoriesData, brandsData, suppliersData] = await Promise.all([
        productsAPI.getProducts(storeIdToUse),
        productsAPI.getCategories(storeIdToUse),
        productsAPI.getBrands(storeIdToUse),
        productsAPI.getSuppliers(storeIdToUse),
      ]);

      // Save to database in background (non-blocking, optional)
      if (Database.isInitialized() && productsData && Array.isArray(productsData)) {
        // Don't await - save in background
        Database.saveProducts(productsData.map((p: any) => ({
          ...p,
          store_id: storeIdToUse,
          synced_at: Math.floor(Date.now() / 1000),
        }))).catch((error: any) => {
          // Silently fail - database is optional
          console.warn('[ProductManagement] Background save to database failed:', error);
        });
      }

      const normalizedProducts = (productsData || []).map((product: Product) => ({
        ...product,
        cost_price: product.cost_price ? parseFloat(product.cost_price) : 0,
        sell_price_per_piece: product.sell_price_per_piece ? parseFloat(product.sell_price_per_piece) : 0,
        quantity_per_pack: product.quantity_per_pack ? parseInt(product.quantity_per_pack) : 1,
        cost_per_unit: product.cost_per_unit ? parseFloat(product.cost_per_unit) : 0,
        profit_per_unit: product.profit_per_unit ? parseFloat(product.profit_per_unit) : 0,
        profit_margin: product.profit_margin ? parseFloat(product.profit_margin) : 0,
      }));

      setProducts(normalizedProducts);
      setCategories(categoriesData);
      setBrands(brandsData);
      setSuppliers(suppliersData);
    } catch (error: any) {
      console.error('Error loading data:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load products';
      let errorTitle = 'Error';
      
      if (error.code === 'NETWORK_ERROR' || !error.response) {
        errorTitle = 'Network Error';
        errorMessage = 'Unable to connect to the server. Please check:\n\n' +
          '1. Backend server is running\n' +
          '2. Device is on the same network\n' +
          '3. IP address is correct (10.1.10.120:3000)';
      } else if (error.response?.status === 401) {
        errorTitle = 'Authentication Error';
        errorMessage = 'Your session has expired. Please log in again.';
      } else if (error.response?.status === 404) {
        errorTitle = 'Not Found';
        errorMessage = 'Products endpoint not found. Please check the API configuration.';
      } else if (error.response?.status >= 500) {
        errorTitle = 'Server Error';
        errorMessage = 'Server error occurred. Please try again later.';
      }
      
      Alert.alert(errorTitle, errorMessage, [
        { text: 'OK', style: 'default' },
        {
          text: 'Retry',
          style: 'default',
          onPress: () => loadData(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.product_name?.toLowerCase().includes(query) ||
          product.product_id?.toLowerCase().includes(query) ||
          product.upc?.toLowerCase().includes(query) ||
          product.brand?.toLowerCase().includes(query) ||
          product.category?.toLowerCase().includes(query) ||
          product.variant?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }

    setFilteredProducts(filtered);
  };

  const openEditModal = (product: Product) => {
    if (!canEdit) {
      Alert.alert('Permission Denied', 'Only admins and managers can edit products.');
      return;
    }
    
    // If this is a variant product (has variant name), find the base product
    let baseProduct = product;
    if (product.variant) {
      // This is a variant - find the base product (same product_id and id, but no variant)
      // Try to find base product with same product_id and id but no variant field or null variant
      const base = products.find(p => 
        p.product_id === product.product_id && 
        p.id === product.id &&
        (!p.variant || p.variant === null || p.variant === '')
      );
      if (base) {
        baseProduct = base;
        console.log('[ProductManagement] Found base product for variant:', {
          variant: product.variant,
          baseProduct: base.product_name,
          product_id: base.product_id
        });
      } else {
        // If we can't find the base product, create a base product from the variant
        // This happens when only variants are loaded but not the base product
        console.warn('[ProductManagement] Could not find base product for variant, using variant as base:', product);
        baseProduct = {
          ...product,
          variant: null, // Remove variant to make it the base
          upc: product.upc, // Keep UPC for now
        };
      }
    }
    
    setSelectedProduct(baseProduct);
    
    // Parse variants if they exist
    let parsedVariants: Variant[] = [];
    if (baseProduct.variants_enabled && baseProduct.variants) {
      try {
        const variantData = typeof baseProduct.variants === 'string' 
          ? JSON.parse(baseProduct.variants) 
          : baseProduct.variants;
        if (Array.isArray(variantData)) {
          parsedVariants = variantData.map((v: any) => ({
            name: typeof v === 'string' ? v : (v.name || v.variant || ''),
            upc: typeof v === 'object' && v.upc ? v.upc : (typeof v === 'object' && v.name ? baseProduct.upc : ''),
          }));
        }
      } catch (e) {
        console.error('Error parsing variants:', e);
      }
    }
    
    setEditForm({
      product_name: baseProduct.product_name || '',
      category: baseProduct.category || '',
      brand: baseProduct.brand || '',
      supplier: baseProduct.supplier || '',
      cost_price: baseProduct.cost_price?.toString() || '0',
      sell_price_per_piece: baseProduct.sell_price_per_piece?.toString() || '0',
      quantity_per_pack: baseProduct.quantity_per_pack?.toString() || '1',
      upc: baseProduct.upc || '',
      vape_tax: (baseProduct as any).vape_tax || false,
    });
    setVariants(parsedVariants);
    setVariantsEnabled(baseProduct.variants_enabled || false);
    setShowEditModal(true);
  };

  const openAddModal = () => {
    if (!canEdit) {
      Alert.alert('Permission Denied', 'Only admins and managers can add products.');
      return;
    }
    setSelectedProduct(null);
    setEditForm({
      product_name: '',
      category: '',
      brand: '',
      supplier: '',
      cost_price: '',
      sell_price_per_piece: '',
      quantity_per_pack: '1',
      upc: '',
      vape_tax: false,
    });
    setVariants([]);
    setVariantsEnabled(false);
    setShowAddModal(true);
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
      setEditForm({ ...editForm, category: trimmed });
      setNewCategory('');
      setShowCategoryDropdown(false);
    } else if (trimmed && categories.includes(trimmed)) {
      setEditForm({ ...editForm, category: trimmed });
      setNewCategory('');
      setShowCategoryDropdown(false);
    }
  };

  const handleAddBrand = () => {
    const trimmed = newBrand.trim();
    if (trimmed && !brands.includes(trimmed)) {
      setBrands([...brands, trimmed]);
      setEditForm({ ...editForm, brand: trimmed });
      setNewBrand('');
      setShowBrandDropdown(false);
    } else if (trimmed && brands.includes(trimmed)) {
      setEditForm({ ...editForm, brand: trimmed });
      setNewBrand('');
      setShowBrandDropdown(false);
    }
  };

  const handleAddSupplier = () => {
    const trimmed = newSupplier.trim();
    if (trimmed && !suppliers.includes(trimmed)) {
      setSuppliers([...suppliers, trimmed]);
      setEditForm({ ...editForm, supplier: trimmed });
      setNewSupplier('');
      setShowSupplierDropdown(false);
    } else if (trimmed && suppliers.includes(trimmed)) {
      setEditForm({ ...editForm, supplier: trimmed });
      setNewSupplier('');
      setShowSupplierDropdown(false);
    }
  };

  const handleSave = async () => {
    if (!storeId) return;

    // Validate required fields
    if (!editForm.product_name || !editForm.product_name.trim()) {
      Alert.alert('Invalid Input', 'Product name is required');
      return;
    }

    const costPrice = parseFloat(editForm.cost_price) || 0;
    const sellPrice = parseFloat(editForm.sell_price_per_piece) || 0;
    const quantityPerPack = parseInt(editForm.quantity_per_pack) || 1;

    if (costPrice < 0) {
      Alert.alert('Invalid Input', 'Cost price must be >= 0');
      return;
    }

    if (sellPrice < 0) {
      Alert.alert('Invalid Input', 'Selling price must be >= 0');
      return;
    }

    if (quantityPerPack < 1) {
      Alert.alert('Invalid Input', 'Quantity per pack must be >= 1');
      return;
    }

    // Prepare product data
    const productData: any = {
      product_name: editForm.product_name.trim(),
      category: editForm.category || null,
      brand: editForm.brand || null,
      supplier: editForm.supplier || null,
      cost_price: costPrice,
      sell_price_per_piece: sellPrice,
      quantity_per_pack: quantityPerPack,
      upc: editForm.upc.trim() || null,
      vape_tax: editForm.vape_tax || false,
    };

    // Handle variants
    if (variantsEnabled && variants.length > 0) {
      productData.variants_enabled = true;
      productData.variants = variants.filter(v => v.name.trim() && v.upc.trim());
      productData.variant = null; // Parent product doesn't have variant
      productData.upc = null; // Parent product doesn't have UPC (variants do)
    } else {
      productData.variants_enabled = false;
      productData.variants = null;
    }

    try {
      setSaving(true);
      
      // Check if online
      const netInfo = await NetInfo.fetch();
      const online = netInfo.isConnected || false;
      
      if (selectedProduct) {
        // Update existing product
        const productId = selectedProduct.id;
        
        // Save locally first
        const updatedProduct = {
          ...selectedProduct,
          ...productData,
          id: productId,
          store_id: storeId,
          synced_at: online ? Math.floor(Date.now() / 1000) : null,
        };
        await Database.saveProduct(updatedProduct);
        
        if (online) {
          try {
            // Try to sync immediately
            await productsAPI.update(productId, productData);
            // Update sync timestamp
            updatedProduct.synced_at = Math.floor(Date.now() / 1000);
            await Database.saveProduct(updatedProduct);
            Alert.alert('Success', 'Product updated successfully');
          } catch (error: any) {
            // Queue for later sync
            await SyncService.queueOperation({
              operationType: 'update_product',
              endpoint: `/products/${productId}`,
              method: 'PUT',
              payload: productData,
            });
            Alert.alert('Success', 'Product updated locally. Will sync when online.');
          }
        } else {
          // Queue for later
          await SyncService.queueOperation({
            operationType: 'update_product',
            endpoint: `/products/${productId}`,
            method: 'PUT',
            payload: productData,
          });
          Alert.alert('Success', 'Product updated offline. Will sync when online.');
        }
        
        setShowEditModal(false);
        setShowCategoryDropdown(false);
        setShowBrandDropdown(false);
        setShowSupplierDropdown(false);
      } else {
        // Create new product
        const localProductId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Generate product ID if category is provided and online
        if (editForm.category && online) {
          try {
            const idResponse = await productsAPI.generateProductId(storeId, editForm.category);
            productData.product_id = idResponse.product_id;
          } catch (e) {
            console.error('Error generating product ID:', e);
            // Use local ID if generation fails
            productData.product_id = `${editForm.category.toUpperCase().substring(0, 3)}${Date.now()}`;
          }
        } else if (editForm.category) {
          // Generate local ID for offline
          productData.product_id = `${editForm.category.toUpperCase().substring(0, 3)}${Date.now()}`;
        }
        
        // Save locally first
        const newProduct = {
          ...productData,
          id: localProductId,
          store_id: storeId,
          synced_at: online ? Math.floor(Date.now() / 1000) : null,
        };
        await Database.saveProduct(newProduct);
        
        if (online) {
          try {
            // Try to sync immediately
            productData.auto_generate_id = !productData.product_id && !!editForm.category;
            const createdProduct = await productsAPI.create(storeId, productData);
            // Update with server ID and sync timestamp
            newProduct.id = createdProduct.id;
            newProduct.product_id = createdProduct.product_id;
            newProduct.synced_at = Math.floor(Date.now() / 1000);
            await Database.saveProduct(newProduct);
            Alert.alert('Success', 'Product created successfully');
          } catch (error: any) {
            // Queue for later sync
            await SyncService.queueOperation({
              operationType: 'create_product',
              endpoint: `/products/store/${storeId}`,
              method: 'POST',
              payload: productData,
            });
            Alert.alert('Success', 'Product created locally. Will sync when connection is restored.');
          }
        } else {
          // Queue for later
          await SyncService.queueOperation({
            operationType: 'create_product',
            endpoint: `/products/store/${storeId}`,
            method: 'POST',
            payload: productData,
          });
          Alert.alert('Success', 'Product created offline. Will sync when online.');
        }
        
        setShowAddModal(false);
        setShowCategoryDropdown(false);
        setShowBrandDropdown(false);
        setShowSupplierDropdown(false);
      }
      
      loadData();
    } catch (error: any) {
      console.error('Error saving product:', error);
      
      let errorMessage = 'Failed to save product';
      
      if (error.code === 'NETWORK_ERROR' || !error.response) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.status === 401) {
        errorMessage = 'Your session has expired. Please log in again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = () => {
    if (!newVariant.name.trim()) {
      Alert.alert('Invalid Input', 'Variant name is required');
      return;
    }
    if (!newVariant.upc.trim()) {
      Alert.alert('Invalid Input', 'Variant UPC is required');
      return;
    }
    
    // Check for duplicate variant names
    if (variants.some(v => v.name.toLowerCase() === newVariant.name.trim().toLowerCase())) {
      Alert.alert('Duplicate Variant', 'A variant with this name already exists');
      return;
    }
    
    // Check for duplicate UPCs
    if (variants.some(v => v.upc === newVariant.upc.trim())) {
      Alert.alert('Duplicate UPC', 'A variant with this UPC already exists');
      return;
    }
    
    setVariants([...variants, { ...newVariant, name: newVariant.name.trim(), upc: newVariant.upc.trim() }]);
    setNewVariant({ name: '', upc: '' });
  };

  const handleDeleteVariant = (index: number) => {
    Alert.alert(
      'Delete Variant',
      'Are you sure you want to delete this variant?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setVariants(variants.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  const handleEditVariant = (index: number) => {
    setEditingVariantIndex(index);
    setNewVariant({ ...variants[index] });
  };

  const handleSaveVariantEdit = () => {
    if (!newVariant.name.trim() || !newVariant.upc.trim()) {
      Alert.alert('Invalid Input', 'Variant name and UPC are required');
      return;
    }
    
    if (editingVariantIndex !== null) {
      const updatedVariants = [...variants];
      updatedVariants[editingVariantIndex] = { 
        name: newVariant.name.trim(), 
        upc: newVariant.upc.trim() 
      };
      setVariants(updatedVariants);
      setEditingVariantIndex(null);
      setNewVariant({ name: '', upc: '' });
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => openEditModal(item)}
        disabled={!canEdit}
      >
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{item.full_product_name || item.product_name}</Text>
          {item.variant && (
            <Text style={styles.variantText}>Variant: {item.variant}</Text>
          )}
        </View>
        <View style={styles.productDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Product ID:</Text>
            <Text style={styles.detailValue}>{item.product_id}</Text>
          </View>
          {item.upc && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>UPC:</Text>
              <Text style={styles.detailValue}>{item.upc}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category:</Text>
            <Text style={styles.detailValue}>{item.category || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Brand:</Text>
            <Text style={styles.detailValue}>{item.brand || 'N/A'}</Text>
          </View>
          <View style={styles.priceRow}>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Cost Price</Text>
              <Text style={styles.priceValue}>${item.cost_price?.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Selling Price</Text>
              <Text style={styles.priceValue}>${item.sell_price_per_piece?.toFixed(2) || '0.00'}</Text>
            </View>
          </View>
          <View style={styles.profitRow}>
            <Text style={styles.profitLabel}>Profit Margin:</Text>
            <Text style={[styles.profitValue, { color: item.profit_margin >= 0 ? '#2d8659' : '#d32f2f' }]}>
              {item.profit_margin?.toFixed(2) || '0.00'}%
            </Text>
          </View>
        </View>
        {canEdit && (
          <View style={styles.editButton}>
            <Text style={styles.editButtonText}>Tap to Edit Prices</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2d8659" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Management</Text>
        {canEdit && (
          <TouchableOpacity onPress={openAddModal} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        )}
        {!canEdit && <View style={styles.headerSpacer} />}
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      {/* Add/Edit Product Modal */}
    <Modal
      visible={showEditModal || showAddModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setShowEditModal(false);
        setShowAddModal(false);
        setShowCategoryDropdown(false);
        setShowBrandDropdown(false);
        setShowSupplierDropdown(false);
      }}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => {
          setShowEditModal(false);
          setShowAddModal(false);
          setShowCategoryDropdown(false);
          setShowBrandDropdown(false);
          setShowSupplierDropdown(false);
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedProduct ? 'Edit Product' : 'Add New Product'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowEditModal(false);
                    setShowAddModal(false);
                  }}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
              {/* Basic Information Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Basic Information</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Product Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm.product_name}
                    onChangeText={(text) => setEditForm({ ...editForm, product_name: text })}
                    placeholder="Enter product name"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Category</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => {
                      setShowCategoryDropdown(!showCategoryDropdown);
                      setShowBrandDropdown(false);
                      setShowSupplierDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownButtonText, !editForm.category && styles.dropdownButtonPlaceholder]}>
                      {editForm.category || 'Select or add category'}
                    </Text>
                    <Text style={styles.dropdownArrow}>{showCategoryDropdown ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showCategoryDropdown && (
                    <View style={styles.dropdownContainer}>
                      <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, !editForm.category && styles.dropdownItemActive]}
                          onPress={() => {
                            setEditForm({ ...editForm, category: '' });
                            setShowCategoryDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, !editForm.category && styles.dropdownItemTextActive]}>
                            None
                          </Text>
                        </TouchableOpacity>
                        {categories.map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.dropdownItem, editForm.category === cat && styles.dropdownItemActive]}
                            onPress={() => {
                              setEditForm({ ...editForm, category: cat });
                              setShowCategoryDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, editForm.category === cat && styles.dropdownItemTextActive]}>
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={styles.dropdownAddSection}>
                        <TextInput
                          style={styles.dropdownInput}
                          placeholder="Add new category"
                          placeholderTextColor="#999"
                          value={newCategory}
                          onChangeText={setNewCategory}
                          onSubmitEditing={handleAddCategory}
                        />
                        <TouchableOpacity
                          style={styles.dropdownAddButton}
                          onPress={handleAddCategory}
                        >
                          <Text style={styles.dropdownAddButtonText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Brand</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => {
                      setShowBrandDropdown(!showBrandDropdown);
                      setShowCategoryDropdown(false);
                      setShowSupplierDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownButtonText, !editForm.brand && styles.dropdownButtonPlaceholder]}>
                      {editForm.brand || 'Select or add brand'}
                    </Text>
                    <Text style={styles.dropdownArrow}>{showBrandDropdown ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showBrandDropdown && (
                    <View style={styles.dropdownContainer}>
                      <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, !editForm.brand && styles.dropdownItemActive]}
                          onPress={() => {
                            setEditForm({ ...editForm, brand: '' });
                            setShowBrandDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, !editForm.brand && styles.dropdownItemTextActive]}>
                            None
                          </Text>
                        </TouchableOpacity>
                        {brands.map((brand) => (
                          <TouchableOpacity
                            key={brand}
                            style={[styles.dropdownItem, editForm.brand === brand && styles.dropdownItemActive]}
                            onPress={() => {
                              setEditForm({ ...editForm, brand: brand });
                              setShowBrandDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, editForm.brand === brand && styles.dropdownItemTextActive]}>
                              {brand}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={styles.dropdownAddSection}>
                        <TextInput
                          style={styles.dropdownInput}
                          placeholder="Add new brand"
                          placeholderTextColor="#999"
                          value={newBrand}
                          onChangeText={setNewBrand}
                          onSubmitEditing={handleAddBrand}
                        />
                        <TouchableOpacity
                          style={styles.dropdownAddButton}
                          onPress={handleAddBrand}
                        >
                          <Text style={styles.dropdownAddButtonText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Supplier</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => {
                      setShowSupplierDropdown(!showSupplierDropdown);
                      setShowCategoryDropdown(false);
                      setShowBrandDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownButtonText, !editForm.supplier && styles.dropdownButtonPlaceholder]}>
                      {editForm.supplier || 'Select or add supplier'}
                    </Text>
                    <Text style={styles.dropdownArrow}>{showSupplierDropdown ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showSupplierDropdown && (
                    <View style={styles.dropdownContainer}>
                      <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, !editForm.supplier && styles.dropdownItemActive]}
                          onPress={() => {
                            setEditForm({ ...editForm, supplier: '' });
                            setShowSupplierDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, !editForm.supplier && styles.dropdownItemTextActive]}>
                            None
                          </Text>
                        </TouchableOpacity>
                        {suppliers.map((supplier) => (
                          <TouchableOpacity
                            key={supplier}
                            style={[styles.dropdownItem, editForm.supplier === supplier && styles.dropdownItemActive]}
                            onPress={() => {
                              setEditForm({ ...editForm, supplier: supplier });
                              setShowSupplierDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, editForm.supplier === supplier && styles.dropdownItemTextActive]}>
                              {supplier}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={styles.dropdownAddSection}>
                        <TextInput
                          style={styles.dropdownInput}
                          placeholder="Add new supplier"
                          placeholderTextColor="#999"
                          value={newSupplier}
                          onChangeText={setNewSupplier}
                          onSubmitEditing={handleAddSupplier}
                        />
                        <TouchableOpacity
                          style={styles.dropdownAddButton}
                          onPress={handleAddSupplier}
                        >
                          <Text style={styles.dropdownAddButtonText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Pricing Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pricing & Inventory</Text>
                
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, styles.formGroupHalf, { marginRight: 12 }]}>
                    <Text style={styles.formLabel}>Cost Price ($)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm.cost_price}
                      onChangeText={(text) => setEditForm({ ...editForm, cost_price: text })}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={[styles.formGroup, styles.formGroupHalf]}>
                    <Text style={styles.formLabel}>Selling Price ($)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm.sell_price_per_piece}
                      onChangeText={(text) => setEditForm({ ...editForm, sell_price_per_piece: text })}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Quantity Per Pack</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm.quantity_per_pack}
                    onChangeText={(text) => setEditForm({ ...editForm, quantity_per_pack: text })}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroup}>
                  <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => setEditForm({ ...editForm, vape_tax: !editForm.vape_tax })}
                  >
                    <View style={[styles.checkbox, editForm.vape_tax && styles.checkboxChecked]}>
                      {editForm.vape_tax && <Text style={styles.checkboxCheckmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>PA Vape Tax</Text>
                  </TouchableOpacity>
                </View>

                {!variantsEnabled && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>UPC/Barcode</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm.upc}
                      onChangeText={(text) => setEditForm({ ...editForm, upc: text })}
                      placeholder="Enter UPC/barcode"
                      placeholderTextColor="#999"
                    />
                  </View>
                )}
              </View>

              {/* Variants Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Variants</Text>
                <View style={styles.variantToggleContainer}>
                  <TouchableOpacity
                    style={styles.variantToggle}
                    onPress={() => {
                      setVariantsEnabled(!variantsEnabled);
                      if (!variantsEnabled) {
                        setVariants([]);
                      }
                    }}
                  >
                    <View style={[styles.toggleSwitch, variantsEnabled && styles.toggleSwitchActive]}>
                      <View style={[styles.toggleCircle, variantsEnabled && styles.toggleCircleActive]} />
                    </View>
                    <Text style={styles.variantToggleText}>Enable Variants</Text>
                  </TouchableOpacity>
                  {variantsEnabled && (
                    <TouchableOpacity
                      style={styles.manageVariantButton}
                      onPress={() => setShowVariantModal(true)}
                    >
                      <Text style={styles.manageVariantButtonText}>
                        Manage Variants ({variants.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {variantsEnabled && variants.length > 0 && (
                  <View style={styles.variantPreview}>
                    <Text style={styles.variantPreviewText}>
                      {variants.length} variant{variants.length !== 1 ? 's' : ''} configured
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Footer - Fixed at bottom */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setShowAddModal(false);
                  setShowCategoryDropdown(false);
                  setShowBrandDropdown(false);
                  setShowSupplierDropdown(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{selectedProduct ? 'Save Changes' : 'Create Product'}</Text>
                )}
              </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>

      {/* Variant Management Modal */}
      <Modal
        visible={showVariantModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVariantModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Variants</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowVariantModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
              {/* Add Variant */}
              <View style={styles.variantForm}>
                <Text style={styles.formLabel}>Add New Variant</Text>
                <TextInput
                  style={styles.formInput}
                  value={editingVariantIndex !== null ? newVariant.name : newVariant.name}
                  onChangeText={(text) => setNewVariant({ ...newVariant, name: text })}
                  placeholder="Variant name (e.g., Cool Mint)"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={[styles.formInput, { marginTop: 8 }]}
                  value={editingVariantIndex !== null ? newVariant.upc : newVariant.upc}
                  onChangeText={(text) => setNewVariant({ ...newVariant, upc: text })}
                  placeholder="UPC/Barcode"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                />
                <View style={styles.variantFormButtons}>
                  {editingVariantIndex !== null ? (
                    <>
                      <TouchableOpacity
                        style={[styles.variantActionButton, styles.saveVariantButton]}
                        onPress={handleSaveVariantEdit}
                      >
                        <Text style={styles.variantActionButtonText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.variantActionButton, styles.cancelVariantButton]}
                        onPress={() => {
                          setEditingVariantIndex(null);
                          setNewVariant({ name: '', upc: '' });
                        }}
                      >
                        <Text style={styles.variantActionButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.variantActionButton, styles.addVariantButton]}
                      onPress={handleAddVariant}
                    >
                      <Text style={styles.variantActionButtonText}>Add Variant</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Variants List */}
              <View style={styles.variantsList}>
                {variants.map((variant, index) => (
                  <View key={index} style={styles.variantItem}>
                    <View style={styles.variantItemInfo}>
                      <Text style={styles.variantItemName}>{variant.name}</Text>
                      <Text style={styles.variantItemUPC}>UPC: {variant.upc}</Text>
                    </View>
                    <View style={styles.variantItemActions}>
                      <TouchableOpacity
                        style={styles.variantEditButton}
                        onPress={() => handleEditVariant(index)}
                      >
                        <Text style={styles.variantEditButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.variantDeleteButton}
                        onPress={() => handleDeleteVariant(index)}
                      >
                        <Text style={styles.variantDeleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {variants.length === 0 && (
                  <Text style={styles.emptyVariantsText}>No variants added yet</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => setShowVariantModal(false)}
              >
                <Text style={styles.saveButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    backgroundColor: '#2d8659',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 60,
  },
  addButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  categorySelector: {
    maxHeight: 50,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxText: {
    fontSize: 16,
    color: '#333',
  },
  variantButton: {
    backgroundColor: '#2d8659',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  variantButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  variantForm: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  variantFormButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  variantActionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  addVariantButton: {
    backgroundColor: '#2d8659',
  },
  saveVariantButton: {
    backgroundColor: '#2d8659',
  },
  cancelVariantButton: {
    backgroundColor: '#999',
  },
  variantActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  variantsList: {
    marginTop: 20,
    marginBottom: 20,
  },
  variantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  variantItemInfo: {
    flex: 1,
  },
  variantItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  variantItemUPC: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  variantItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  variantEditButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  variantEditButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  variantDeleteButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  variantDeleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyVariantsText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
  },
  searchContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  categoryContainer: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#2d8659',
  },
  categoryChipText: {
    color: '#666',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productHeader: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  variantText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  productDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d8659',
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  profitLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  profitValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2d8659',
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Dimensions.get('window').height * 0.9,
    maxHeight: '95%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  modalScrollView: {
    flex: 1,
    flexGrow: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d8659',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e8f5e9',
  },
  formGroup: {
    marginBottom: 24,
  },
  formGroupHalf: {
    flex: 1,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  formInput: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
    minHeight: 50,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  selectorContainer: {
    marginTop: 4,
  },
  selectorContent: {
    paddingRight: 20,
  },
  selectorChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  selectorChipActive: {
    backgroundColor: '#2d8659',
    borderColor: '#2d8659',
  },
  selectorChipText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  selectorChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 14,
    minHeight: 50,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownButtonPlaceholder: {
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  dropdownList: {
    maxHeight: 180,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemActive: {
    backgroundColor: '#e8f5e9',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemTextActive: {
    color: '#2d8659',
    fontWeight: '600',
  },
  dropdownAddSection: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  dropdownInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    marginRight: 8,
  },
  dropdownAddButton: {
    backgroundColor: '#2d8659',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
  },
  dropdownAddButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Checkbox styles
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#2d8659',
    borderColor: '#2d8659',
  },
  checkboxCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  variantToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  variantToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    marginRight: 12,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleSwitchActive: {
    backgroundColor: '#2d8659',
  },
  toggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  variantToggleText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  manageVariantButton: {
    backgroundColor: '#2d8659',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  manageVariantButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  variantPreview: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  variantPreviewText: {
    color: '#2d8659',
    fontSize: 14,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    flexShrink: 0,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2d8659',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Keep existing variantForm styles for variant modal
  variantForm: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
});

