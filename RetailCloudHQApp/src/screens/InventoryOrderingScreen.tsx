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
} from 'react-native';
import { productsAPI } from '../api/productsAPI';
import { ordersAPI } from '../api/ordersAPI';
import { deviceAuthAPI } from '../api/deviceAuthAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Database from '../services/database';
import SyncService from '../services/syncService';

// Import NetInfo with error handling
let NetInfo: any;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (error) {
  console.warn('[InventoryOrdering] NetInfo not available, using fallback');
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
  variants_enabled?: boolean; // Flag indicating if product has variants enabled
  variants?: any; // JSON array of variant objects { name: string, upc: string }
  _variantIndex?: number; // Internal field for variant grouping
  _variantKey?: string; // Internal field for React keys
}

interface VariantGroup {
  baseProduct: Product;
  variants: Product[];
  hasVariants: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function InventoryOrderingScreen({ navigation, route }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<VariantGroup[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('employee');
  const [submitting, setSubmitting] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedVariantGroup, setSelectedVariantGroup] = useState<VariantGroup | null>(null);
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({});
  const [variantPending, setVariantPending] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [variantGroups, searchQuery, selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      const user = await deviceAuthAPI.getCurrentUser();
      const storedStoreId = await AsyncStorage.getItem('store_id');
      const storedRole = await AsyncStorage.getItem('user_role');
      
      if (user?.store_id || storedStoreId) {
        setStoreId(user?.store_id || storedStoreId);
        setUserRole(user?.role || storedRole || 'employee');

        const storeIdToUse = user?.store_id || storedStoreId;
        
        // Simple API-first approach (original working flow)
        // Load directly from API (fast, simple, works)
        const [productsData, categoriesData] = await Promise.all([
          productsAPI.getProducts(storeIdToUse),
          productsAPI.getCategories(storeIdToUse),
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
            console.warn('[InventoryOrdering] Background save to database failed:', error);
          });
        }

        // Ensure all numeric fields are properly formatted and expand JSON variants
        const expandedProducts: Product[] = [];
        
        (productsData || []).forEach((product: Product) => {
          const normalizedProduct = {
            ...product,
            cost_price: product.cost_price ? parseFloat(product.cost_price) : 0,
            sell_price_per_piece: product.sell_price_per_piece ? parseFloat(product.sell_price_per_piece) : 0,
            quantity_per_pack: product.quantity_per_pack ? parseInt(product.quantity_per_pack) : 1,
            cost_per_unit: product.cost_per_unit ? parseFloat(product.cost_per_unit) : 0,
            profit_per_unit: product.profit_per_unit ? parseFloat(product.profit_per_unit) : 0,
            profit_margin: product.profit_margin ? parseFloat(product.profit_margin) : 0,
          };
          
          // Check if product has variants stored as JSON
          if (normalizedProduct.variants_enabled && normalizedProduct.variants) {
            let parsedVariants: any[] = [];
            
            console.log(`[InventoryOrdering] Found product with variants_enabled:`, {
              product_name: normalizedProduct.product_name,
              product_id: normalizedProduct.product_id,
              variants_type: typeof normalizedProduct.variants,
              variants_value: normalizedProduct.variants,
              variants_enabled: normalizedProduct.variants_enabled
            });
            
            // Parse variants JSON (could be string or already parsed)
            if (typeof normalizedProduct.variants === 'string') {
              try {
                parsedVariants = JSON.parse(normalizedProduct.variants);
                console.log(`[InventoryOrdering] Parsed variants from string:`, parsedVariants);
              } catch (e) {
                console.error('[InventoryOrdering] Error parsing variants JSON:', e);
                parsedVariants = [];
              }
            } else if (Array.isArray(normalizedProduct.variants)) {
              parsedVariants = normalizedProduct.variants;
              console.log(`[InventoryOrdering] Variants already an array:`, parsedVariants);
            } else {
              console.warn(`[InventoryOrdering] Variants is not a string or array:`, typeof normalizedProduct.variants, normalizedProduct.variants);
            }
            
            // Expand variants into separate product-like objects
            if (parsedVariants.length > 0) {
              console.log(`[InventoryOrdering] Expanding ${parsedVariants.length} variants for product ${normalizedProduct.product_name} (product_id: ${normalizedProduct.product_id})`);
              const createdVariants: string[] = [];
              
              parsedVariants.forEach((variant: any, index: number) => {
                const variantName = typeof variant === 'string' ? variant : (variant.name || variant.variant || null);
                const variantUPC = typeof variant === 'object' && variant.upc ? variant.upc : normalizedProduct.upc;
                
                console.log(`[InventoryOrdering] Creating variant ${index + 1}/${parsedVariants.length}:`, {
                  variantName,
                  variantUPC,
                  product_id: normalizedProduct.product_id,
                  parent_id: normalizedProduct.id,
                  variantObject: variant
                });
                
                const variantProduct: Product = {
                  ...normalizedProduct,
                  // Keep the original product ID for ordering (backend needs the real product.id)
                  // Use a composite ID for React key purposes only
                  id: normalizedProduct.id, // Use original product ID for backend ordering
                  variant: variantName,
                  upc: variantUPC,
                  // Store variant index for React key uniqueness
                  _variantIndex: index,
                  _variantKey: `${normalizedProduct.id}_variant_${index}`, // For React keys only
                  // Keep all other fields from parent product
                };
                
                expandedProducts.push(variantProduct);
                createdVariants.push(variantName || `Variant ${index + 1}`);
              });
              
              console.log(`[InventoryOrdering] ✅ Successfully expanded product "${normalizedProduct.product_name}" into ${parsedVariants.length} variants:`, createdVariants);
            } else {
              console.warn(`[InventoryOrdering] ⚠️ No variants in JSON for product ${normalizedProduct.product_name} (variants_enabled=true but parsedVariants.length=0)`);
              // No variants in JSON, but variants_enabled is true - add parent product
              expandedProducts.push(normalizedProduct);
            }
          } else {
            // Regular product (no variants) - add as-is
            if (normalizedProduct.product_name?.toLowerCase().includes('flair')) {
              console.log(`[InventoryOrdering] Product ${normalizedProduct.product_name} has no variants_enabled or variants field:`, {
                variants_enabled: normalizedProduct.variants_enabled,
                hasVariants: !!normalizedProduct.variants
              });
            }
            expandedProducts.push(normalizedProduct);
          }
        });
        
        setProducts(expandedProducts);
        setCategories(categoriesData);
        
        // Debug: Log first few products to see structure
        if (expandedProducts.length > 0) {
          console.log('[InventoryOrdering] Sample product structure:', {
            totalProducts: expandedProducts.length,
            firstProduct: {
              ...expandedProducts[0],
              hasVariantsEnabled: expandedProducts[0].variants_enabled !== undefined
            },
            productsWithFlair: expandedProducts.filter(p => 
              p.product_name?.toLowerCase().includes('flair') || 
              p.product_id?.toLowerCase().includes('dis001')
            ).map(p => ({
              id: p.id,
              product_name: p.product_name,
              variant: p.variant,
              variants_enabled: p.variants_enabled,
              product_id: p.product_id,
              upc: p.upc
            }))
          });
        }
        
        // Group products by product_name, brand, and category to identify variants
        const grouped = groupProductsByVariants(expandedProducts);
        console.log('[InventoryOrdering] Grouped products:', {
          totalGroups: grouped.length,
          groupsWithVariants: grouped.filter(g => g.hasVariants || g.variants.length > 1).map(g => ({
            baseProduct: g.baseProduct.product_name,
            product_id: g.baseProduct.product_id,
            variantCount: g.variants.length,
            hasVariants: g.hasVariants,
            variants: g.variants.map(v => ({ variant: v.variant, id: v.id, upc: v.upc }))
          }))
        });
        setVariantGroups(grouped);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      
      // Check if it's a network error or authentication error
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        Alert.alert(
          'Network Error',
          'Unable to connect to server. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      } else if (error.response?.status === 401) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to login
                if (navigation) {
                  navigation.goBack();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to load products. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const groupProductsByVariants = (products: Product[]): VariantGroup[] => {
    const groups = new Map<string, VariantGroup>();
    
    // Debug: Log all products to see what we're getting
    console.log('[InventoryOrdering] Grouping products. Total products:', products.length);
    products.forEach((p, idx) => {
      if (p.product_name?.toLowerCase().includes('flair')) {
        console.log(`[InventoryOrdering] Product ${idx}:`, {
          id: p.id,
          product_name: p.product_name,
          brand: p.brand,
          category: p.category,
          variant: p.variant,
          variants_enabled: p.variants_enabled,
          product_id: p.product_id
        });
      }
    });
    
    products.forEach((product) => {
      // First, try to group by product_id if available (most reliable for variants)
      // Variants should have the same product_id (e.g., DIS001)
      let key: string;
      
      if (product.product_id && product.product_id.trim()) {
        // Group by product_id - variants share the same product_id
        key = `product_id:${product.product_id.trim().toLowerCase()}`;
      } else {
        // Fallback: Create a key based on product_name, brand, and category (normalize to handle null/empty)
        // Normalize product_name more aggressively: remove dashes, extra spaces, normalize to lowercase
        let normalizedName = (product.product_name || '').trim().toLowerCase();
        // Remove dashes and normalize spaces
        normalizedName = normalizedName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedBrand = (product.brand || '').trim().toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedCategory = (product.category || '').trim().toLowerCase().replace(/\s+/g, ' ').trim();
        key = `name:${normalizedName}_${normalizedBrand}_${normalizedCategory}`;
      }
      
      if (!groups.has(key)) {
        groups.set(key, {
          baseProduct: product,
          variants: [product],
          hasVariants: product.variants_enabled === true, // Check variants_enabled flag
        });
      } else {
        const group = groups.get(key)!;
        
        // For variants, check if this variant name already exists in the group
        // Use variant name as the unique identifier, not the UUID id (since all variants share the same UUID)
        const variantKey = (product as any)._variantKey || `${product.id}_${product.variant || ''}`;
        const existingVariant = group.variants.find(v => {
          // Match by variant name if both have variant names
          if (product.variant && v.variant) {
            return v.variant.toLowerCase() === product.variant.toLowerCase();
          }
          // Match by variant key if available
          if ((v as any)._variantKey && (product as any)._variantKey) {
            return (v as any)._variantKey === (product as any)._variantKey;
          }
          // Fallback to UUID id (for non-variant products)
          return v.id === product.id;
        });
        
        if (!existingVariant) {
          group.variants.push(product);
          console.log(`[InventoryOrdering] Added variant to group ${key}:`, {
            variant: product.variant,
            variantKey: variantKey,
            totalVariantsInGroup: group.variants.length
          });
        } else {
          console.log(`[InventoryOrdering] Variant already in group ${key}:`, {
            variant: product.variant,
            existingVariant: existingVariant.variant
          });
        }
        
        // Check if we have actual variants (different variant values or multiple products with variants)
        const uniqueVariants = new Set(
          group.variants
            .map(p => p.variant?.trim().toLowerCase() || '')
            .filter(v => v !== '')
        );
        
        // Mark as having variants if:
        // 1. Product has variants_enabled flag set to true, OR
        // 2. We have more than one product in the group, OR
        // 3. We have multiple unique variant values
        if (product.variants_enabled === true || group.variants.length > 1 || uniqueVariants.size > 1) {
          group.hasVariants = true;
          // Update baseProduct variants_enabled if any product in group has it
          if (product.variants_enabled === true) {
            group.baseProduct.variants_enabled = true;
          }
          // Also preserve the variants JSON field from baseProduct if available
          if (product.variants && !group.baseProduct.variants) {
            group.baseProduct.variants = product.variants;
          }
        }
      }
    });
    
    // Sort variants within each group
    return Array.from(groups.values()).map(group => ({
      ...group,
      variants: group.variants.sort((a, b) => {
        const aVariant = (a.variant || '').toLowerCase();
        const bVariant = (b.variant || '').toLowerCase();
        return aVariant.localeCompare(bVariant);
      }),
    }));
  };

  const filterProducts = () => {
    let filtered = [...variantGroups];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (group) =>
          group.baseProduct.product_name?.toLowerCase().includes(query) ||
          group.baseProduct.full_product_name?.toLowerCase().includes(query) ||
          group.baseProduct.product_id?.toLowerCase().includes(query) ||
          group.baseProduct.upc?.toLowerCase().includes(query) ||
          group.baseProduct.brand?.toLowerCase().includes(query) ||
          group.baseProduct.category?.toLowerCase().includes(query) ||
          group.variants.some(v => v.variant?.toLowerCase().includes(query))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((group) => group.baseProduct.category === selectedCategory);
    }

    setFilteredGroups(filtered);
  };

  const handleScanUPC = () => {
    Alert.alert(
      'Scan UPC',
      'Barcode scanner will be implemented. For now, enter UPC in search.',
      [{ text: 'OK' }]
    );
  };

  const checkPendingForVariants = async (variants: Product[]) => {
    if (!storeId) return {};
    const pending: Record<string, number> = {};
    
    for (const variant of variants) {
      // Declare outside try block so it's accessible in catch
      const variantName = variant.variant || null;
      const productIdToUse = variant.id || variant.product_id;
      if (!productIdToUse) {
        console.warn('[InventoryOrdering] Skipping variant pending check (no product ID):', {
          variantId: variant.id,
          variantName,
        });
        pending[variant.id] = 0;
        continue;
      }
      
      try {
        // Pass the variant name to filter by specific variant
        // Use product_id (which is the same for all variants) and the variant name
        
        console.log('[InventoryOrdering] Checking pending for variant:', {
          variantId: variant.id,
          productId: productIdToUse,
          variantName: variantName,
          variant: variant
        });
        
        const pendingOrders = await ordersAPI.getPendingOrdersForProduct(
          storeId, 
          productIdToUse,
          variantName // Pass variant name to filter (e.g., "Cool Mint", "Menthol")
        );
        
        console.log('[InventoryOrdering] Pending orders for variant:', {
          variantId: variant.id,
          variantName: variantName,
          pendingOrdersCount: pendingOrders?.length || 0,
          pendingOrders: pendingOrders
        });
        
        if (pendingOrders && pendingOrders.length > 0) {
          const totalPending = pendingOrders.reduce(
            (sum: number, order: any) => {
              const quantity = parseInt(order.quantity) || 0;
              const quantityDelivered = parseInt(order.quantity_delivered) || 0;
              const pending = quantity - quantityDelivered;
              console.log('[InventoryOrdering] Order item:', {
                orderId: order.order_number,
                quantity,
                quantityDelivered,
                pending,
                variant: order.variant
              });
              return sum + pending;
            },
            0
          );
          pending[variant.id] = totalPending;
          console.log('[InventoryOrdering] Total pending for variant:', {
            variantId: variant.id,
            variantName: variantName,
            totalPending
          });
        } else {
          pending[variant.id] = 0;
        }
      } catch (error: any) {
        // Use console.warn instead of console.error to avoid ErrorReporter catching it
        // This is not a critical error - just set pending to 0 and continue
        console.warn('[InventoryOrdering] Pending check failed for variant (non-critical):', {
          variantId: variant.id,
          variantName: variantName,
          // Only log error details in dev mode
          ...(__DEV__ && {
            error: error?.message || error,
            statusCode: error?.response?.status
          })
        });
        // Set pending to 0 and continue - this is not a blocking error
        pending[variant.id] = 0;
      }
    }
    
    return pending;
  };

  const openVariantModal = async (group: VariantGroup) => {
    console.log('[InventoryOrdering] Opening variant modal with group:', {
      baseProduct: group.baseProduct.product_name,
      product_id: group.baseProduct.product_id,
      variantsCount: group.variants.length,
      hasVariants: group.hasVariants,
      variants: group.variants.map(v => ({ 
        id: v.id, 
        product_id: v.product_id,
        product_name: v.product_name,
        brand: v.brand,
        variant: v.variant,
        variants_enabled: v.variants_enabled
      }))
    });
    
    // If only 1 variant but variants_enabled is true, we still want to show it
    // But let's also check if we should be getting more variants
    if (group.variants.length === 1 && group.baseProduct.variants_enabled) {
      console.warn('[InventoryOrdering] ⚠️ Only 1 variant found but variants_enabled is true. This might indicate a grouping issue.', {
        product_name: group.baseProduct.product_name,
        product_id: group.baseProduct.product_id,
        variants_count: group.variants.length,
        variants: group.variants.map(v => ({ id: v.id, variant: v.variant, _variantKey: (v as any)._variantKey })),
        variants_enabled: group.baseProduct.variants_enabled,
        hasVariantsField: !!group.baseProduct.variants,
        variantsField: group.baseProduct.variants
      });
    }
    
    setSelectedVariantGroup(group);
    setVariantQuantities({});
    
    // Check pending quantities for all variants
    const pending = await checkPendingForVariants(group.variants);
    setVariantPending(pending);
    
    setShowVariantModal(true);
  };

  const addVariantsToCart = () => {
    if (!selectedVariantGroup) return;
    
    // Collect all variants with quantities first
    const variantsToAdd: Array<{ product: Product; quantity: number }> = [];
    let hasQuantity = false;
    
    selectedVariantGroup.variants.forEach((variant) => {
      // Use variant key if available for quantity lookup
      const variantKey = (variant as any)._variantKey || variant.id;
      const qty = variantQuantities[variantKey] || variantQuantities[variant.id] || 0;
      if (qty > 0) {
        hasQuantity = true;
        variantsToAdd.push({ product: variant, quantity: qty });
      }
    });
    
    if (!hasQuantity) {
      Alert.alert('No Quantity', 'Please enter quantity for at least one variant');
      return;
    }
    
    // Update cart state once with all variants
    setCart((currentCart) => {
      const updatedCart = [...currentCart];
      
      variantsToAdd.forEach(({ product: variant, quantity: qty }) => {
        // Find existing item in current cart (match by product id + variant name)
        const existingIndex = updatedCart.findIndex((item) => {
          if (variant.variant) {
            return item.product.id === variant.id && item.product.variant === variant.variant;
          }
          return item.product.id === variant.id && !item.product.variant;
        });
        
        if (existingIndex >= 0) {
          // Update existing item quantity
          updatedCart[existingIndex] = {
            ...updatedCart[existingIndex],
            quantity: updatedCart[existingIndex].quantity + qty,
          };
        } else {
          // Add new item to cart
          updatedCart.push({ product: variant, quantity: qty });
        }
      });
      
      return updatedCart;
    });
    
    setShowVariantModal(false);
    setSelectedVariantGroup(null);
    setVariantQuantities({});
  };

  const addToCart = async (product: Product) => {
    // Check if this product has variants
    const normalizedName = (product.product_name || '').trim().toLowerCase();
    const normalizedBrand = (product.brand || '').trim().toLowerCase();
    const normalizedCategory = (product.category || '').trim().toLowerCase();
    
    const group = variantGroups.find(
      (g) => {
        const gName = (g.baseProduct.product_name || '').trim().toLowerCase();
        const gBrand = (g.baseProduct.brand || '').trim().toLowerCase();
        const gCategory = (g.baseProduct.category || '').trim().toLowerCase();
        return gName === normalizedName && gBrand === normalizedBrand && gCategory === normalizedCategory;
      }
    );
    
    // Check if product has variants enabled or if group has multiple variants
    const hasVariants = (product.variants_enabled === true || (group && group.hasVariants)) && group && group.variants.length > 0;
    
    if (hasVariants) {
      // Open variant selection modal
      await openVariantModal(group);
      return;
    }
    
    // Single product or no variants - check for pending orders
    if (storeId) {
      try {
        const pendingOrders = await ordersAPI.getPendingOrdersForProduct(storeId, product.id);
        if (pendingOrders && pendingOrders.length > 0) {
          const totalPending = pendingOrders.reduce(
            (sum: number, order: any) => {
              const quantity = parseInt(order.quantity) || 0;
              const quantityDelivered = parseInt(order.quantity_delivered) || 0;
              return sum + (quantity - quantityDelivered);
            },
            0
          );
          Alert.alert(
            'Pending Order Exists',
            `This product has ${totalPending} units pending delivery from order ${pendingOrders[0].order_number}.\n\nWould you like to order more?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Order More',
                onPress: () => addToCartConfirmed(product),
              },
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking pending orders:', error);
      }
    }

    addToCartConfirmed(product);
  };

  const addToCartConfirmed = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (productId: string, quantity: number, variant?: string | null) => {
    if (quantity <= 0) {
      removeFromCart(productId, variant);
    } else {
      setCart(
        cart.map((item) => {
          // Match by product id and variant name if variant is provided
          if (variant) {
            if (item.product.id === productId && item.product.variant === variant) {
              return { ...item, quantity };
            }
          } else {
            if (item.product.id === productId && !item.product.variant) {
              return { ...item, quantity };
            }
          }
          return item;
        })
      );
    }
  };

  const removeFromCart = (productId: string, variant?: string | null) => {
    setCart(
      cart.filter((item) => {
        // Remove based on product id and variant name if variant is provided
        if (variant) {
          return !(item.product.id === productId && item.product.variant === variant);
        }
        return !(item.product.id === productId && !item.product.variant);
      })
    );
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart before submitting.');
      return;
    }

    if (!storeId) {
      Alert.alert('Error', 'Store ID not found');
      return;
    }

    Alert.alert(
      'Submit Order',
      `Submit order for ${cart.length} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setSubmitting(true);
              const items = cart.map((item) => ({
                product_id: item.product.id,
                quantity: item.quantity,
                variant: item.product.variant || null, // Include variant in order
              }));

              // Check if online
              const netInfo = await NetInfo.fetch();
              const online = netInfo.isConnected || false;

              // Create local order first
              const localOrderId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const orderId = `ORD-${Date.now()}`;
              
              const order = {
                id: localOrderId,
                order_id: orderId,
                store_id: storeId,
                submitted_by: await AsyncStorage.getItem('user_id'),
                submitted_by_name: null, // Will be set when synced
                notes: null,
                status: 'pending',
                synced: false,
                items: items.map((item, index) => ({
                  id: `${localOrderId}-item-${index}`,
                  product_id: item.product_id,
                  product_name: cart.find(c => c.product.id === item.product_id)?.product.product_name || 'Unknown',
                  variant: item.variant,
                  supplier: null,
                  upc: null,
                  quantity: item.quantity,
                  quantity_delivered: 0,
                  status: 'pending',
                  synced: false,
                })),
              };

              // Save locally first
              await Database.saveOrder(order);

              if (online) {
                try {
                  // Try to sync immediately
                  const result = await ordersAPI.createOrder(storeId, items);
                  
                  // Update with server response
                  if (result.order) {
                    order.id = result.order.id;
                    order.order_id = result.order.order_id;
                    order.synced = true;
                    await Database.saveOrder(order);
                  }
                  
                  Alert.alert('Success', `Order ${order.order_id} submitted successfully!`, [
                    {
                      text: 'OK',
                      onPress: () => {
                        setCart([]);
                        if (navigation) {
                          navigation.goBack();
                        }
                      },
                    },
                  ]);
                } catch (error: any) {
                  // Queue for later sync
                  await SyncService.queueOperation({
                    operationType: 'create_order',
                    endpoint: `/inventory-orders/store/${storeId}`,
                    method: 'POST',
                    payload: { items, notes: null },
                  });
                  
                  Alert.alert('Success', `Order ${order.order_id} created offline. Will sync when connection is restored.`, [
                    {
                      text: 'OK',
                      onPress: () => {
                        setCart([]);
                        if (navigation) {
                          navigation.goBack();
                        }
                      },
                    },
                  ]);
                }
              } else {
                // Queue for later
                await SyncService.queueOperation({
                  operationType: 'create_order',
                  endpoint: `/inventory-orders/store/${storeId}`,
                  method: 'POST',
                  payload: { items, notes: null },
                });
                
                Alert.alert('Success', `Order ${order.order_id} created offline. Will sync when online.`, [
                  {
                    text: 'OK',
                    onPress: () => {
                      setCart([]);
                      if (navigation) {
                        navigation.goBack();
                      }
                    },
                  },
                ]);
              }
            } catch (error: any) {
              console.error('Error submitting order:', error);
              Alert.alert('Error', error.message || 'Failed to submit order');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: VariantGroup }) => {
    const displayProduct = item.baseProduct;
    const variantCount = item.variants.length;
    // Show variant modal if:
    // 1. Product has variants_enabled flag (even with 1 variant), OR
    // 2. hasVariants is true AND we have variants
    const hasVariants = displayProduct.variants_enabled === true || (item.hasVariants && variantCount > 0);
    
    // Debug log
    if (displayProduct.variants_enabled === true || item.hasVariants) {
      console.log('[InventoryOrdering] Product has variants:', {
        product: displayProduct.product_name,
        variants_enabled: displayProduct.variants_enabled,
        hasVariants: item.hasVariants,
        variantCount: variantCount,
        variants: item.variants.map(v => ({ id: v.id, variant: v.variant }))
      });
    }
    
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={async () => {
          if (hasVariants) {
            console.log('[InventoryOrdering] Opening variant modal for:', displayProduct.product_name);
            await openVariantModal(item);
          } else {
            await addToCart(displayProduct);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.productInfo}>
          <Text style={styles.productName}>
            {displayProduct.brand ? `${displayProduct.brand} ` : ''}
            {displayProduct.product_name}
          </Text>
          {hasVariants && (
            <Text style={styles.variantBadge}>
              {variantCount} {variantCount === 1 ? 'variant' : 'variants'} available
            </Text>
          )}
          {!hasVariants && displayProduct.variant && (
            <Text style={styles.variant}>Variant: {displayProduct.variant}</Text>
          )}
          <View style={styles.productDetails}>
            {displayProduct.category && (
              <Text style={styles.detailText}>Category: {displayProduct.category}</Text>
            )}
            {displayProduct.supplier && (
              <Text style={styles.detailText}>Supplier: {displayProduct.supplier}</Text>
            )}
            {displayProduct.upc && <Text style={styles.detailText}>UPC: {displayProduct.upc}</Text>}
          </View>
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <View style={styles.priceInfo}>
              <Text style={styles.priceText}>
                Cost: ${(displayProduct.cost_price || 0).toFixed(2)} | Sell: ${(displayProduct.sell_price_per_piece || 0).toFixed(2)}
              </Text>
              <Text style={styles.profitText}>
                Profit: ${(displayProduct.profit_per_unit || 0).toFixed(2)} ({(displayProduct.profit_margin || 0).toFixed(1)}%)
              </Text>
            </View>
          )}
        </View>
        <View style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.product.full_product_name}</Text>
        {item.product.variant && (
          <Text style={styles.cartItemVariant}>{item.product.variant}</Text>
        )}
      </View>
      <View style={styles.cartItemControls}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateCartQuantity(item.product.id, item.quantity - 1)}
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateCartQuantity(item.product.id, item.quantity + 1)}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFromCart(item.product.id)}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2d8659" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory Ordering</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search and Filters */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products, UPC, brand..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.scanButton} onPress={handleScanUPC}>
          <Text style={styles.scanButtonText}>📷 Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        <TouchableOpacity
          style={[
            styles.categoryChip,
            selectedCategory === null && styles.categoryChipActive,
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.categoryChipText,
              selectedCategory === null && styles.categoryChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products List */}
      <FlatList
        data={filteredGroups}
        renderItem={renderProduct}
        keyExtractor={(item) => `${item.baseProduct.product_id || item.baseProduct.id}_${item.baseProduct.product_name}_${item.baseProduct.brand}`}
        contentContainerStyle={styles.productsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      {/* Variant Selection Modal */}
      <Modal
        visible={showVariantModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVariantModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedVariantGroup?.baseProduct.brand} {selectedVariantGroup?.baseProduct.product_name}
              </Text>
              <TouchableOpacity
                onPress={() => setShowVariantModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {selectedVariantGroup && selectedVariantGroup.variants.length === 0 && (
                <View style={styles.variantItem}>
                  <Text style={styles.variantName}>No variants available</Text>
                </View>
              )}
              {selectedVariantGroup?.variants.map((variant, index) => {
                // Use variant key if available, otherwise use id
                const variantKey = (variant as any)._variantKey || variant.id || `variant_${index}`;
                const pending = variantPending[variant.id] || 0;
                const currentQty = variantQuantities[variantKey] || variantQuantities[variant.id] || 0;
                
                // Debug log for each variant being rendered
                console.log(`[InventoryOrdering] Rendering variant ${index + 1}:`, {
                  id: variant.id,
                  product_id: variant.product_id,
                  variant: variant.variant,
                  product_name: variant.product_name,
                  variantKey: variantKey
                });
                
                return (
                  <View key={variantKey} style={styles.variantItem}>
                    <View style={styles.variantInfo}>
                      <Text style={styles.variantName}>
                        {variant.variant && variant.variant.trim() ? variant.variant : `Variant ${index + 1}`}
                      </Text>
                      {variant.upc && (
                        <Text style={styles.variantSubtext}>UPC: {variant.upc}</Text>
                      )}
                      {pending > 0 && (
                        <Text style={styles.pendingText}>
                          Quantity {currentQty} & Pending {pending}
                        </Text>
                      )}
                    </View>
                    <View style={styles.variantControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => {
                          const current = variantQuantities[variantKey] || variantQuantities[variant.id] || 0;
                          if (current > 0) {
                            setVariantQuantities({
                              ...variantQuantities,
                              [variantKey]: current - 1,
                            });
                          }
                        }}
                      >
                        <Text style={styles.quantityButtonText}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.variantQuantityInput}
                        value={String(variantQuantities[variantKey] || variantQuantities[variant.id] || 0)}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 0;
                          setVariantQuantities({
                            ...variantQuantities,
                            [variantKey]: num,
                          });
                        }}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => {
                          const current = variantQuantities[variantKey] || variantQuantities[variant.id] || 0;
                          setVariantQuantities({
                            ...variantQuantities,
                            [variantKey]: current + 1,
                          });
                        }}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowVariantModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={addVariantsToCart}
              >
                <Text style={styles.modalAddText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cart */}
      {cart.length > 0 && (
        <View style={styles.cartContainer}>
          <Text style={styles.cartTitle}>Cart ({cart.length})</Text>
          <ScrollView style={styles.cartList}>
            {cart.map((item, index) => {
              // Create unique key for cart items (product id + variant name)
              const cartItemKey = item.product.variant 
                ? `${item.product.id}_${item.product.variant}_${index}` 
                : `${item.product.id}_${index}`;
              
              return (
                <View key={cartItemKey} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>
                      {item.product.brand ? `${item.product.brand} ` : ''}
                      {item.product.product_name}
                    </Text>
                    {item.product.variant && (
                      <Text style={styles.cartItemVariant}>{item.product.variant}</Text>
                    )}
                  </View>
                  <View style={styles.cartItemControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateCartQuantity(item.product.id, item.quantity - 1, item.product.variant)}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateCartQuantity(item.product.id, item.quantity + 1, item.product.variant)}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeFromCart(item.product.id, item.product.variant)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={submitOrder}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                Submit Order ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    backgroundColor: '#2d8659',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 60,
  },
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  scanButton: {
    backgroundColor: '#2d8659',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryScroll: {
    maxHeight: 50,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#2d8659',
    borderColor: '#2d8659',
  },
  categoryChipText: {
    color: '#666',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  productsList: {
    padding: 16,
    paddingBottom: 200,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  variantBadge: {
    fontSize: 12,
    color: '#2d8659',
    fontWeight: '600',
    marginBottom: 4,
  },
  variant: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  productDetails: {
    marginTop: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  priceInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  priceText: {
    fontSize: 12,
    color: '#666',
  },
  profitText: {
    fontSize: 12,
    color: '#2d8659',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#2d8659',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
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
  cartContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    maxHeight: 300,
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cartList: {
    maxHeight: 150,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cartItemVariant: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d8659',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff4444',
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#2d8659',
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#666',
  },
  modalScroll: {
    maxHeight: 400,
    padding: 20,
  },
  variantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  variantInfo: {
    flex: 1,
  },
  variantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  variantSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  pendingText: {
    fontSize: 12,
    color: '#ff9800',
    marginTop: 4,
  },
  variantControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  variantQuantityInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAddButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#2d8659',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalAddText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
