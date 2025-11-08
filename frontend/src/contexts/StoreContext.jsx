import { createContext, useContext, useState, useEffect } from 'react';
import { storesAPI, storeTemplatesAPI } from '../services/api';
import { useAuth } from './AuthContext';

const StoreContext = createContext(null);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

export const StoreProvider = ({ children }) => {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [enabledFeatures, setEnabledFeatures] = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      loadStores();
    } else if (user && user.role === 'super_admin') {
      // Super admin doesn't need store selection
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Auto-select first active store if available
    if (stores.length > 0 && !selectedStore) {
      const activeStore = stores.find(s => s.is_active !== false && !s.deleted_at) || stores[0];
      if (activeStore) {
        setSelectedStore(activeStore);
        localStorage.setItem('selectedStoreId', activeStore.id);
      }
    }
  }, [stores]);

  useEffect(() => {
    // Restore selected store from localStorage
    const storedStoreId = localStorage.getItem('selectedStoreId');
    if (storedStoreId && stores.length > 0) {
      const store = stores.find(s => s.id === storedStoreId);
      if (store) {
        setSelectedStore(store);
      }
    }
  }, [stores]);

  const loadStores = async () => {
    try {
      const response = await storesAPI.getAll();
      const userStores = response.data.stores || [];
      setStores(userStores);
      
      // Restore selected store from localStorage
      const storedStoreId = localStorage.getItem('selectedStoreId');
      if (storedStoreId) {
        const store = userStores.find(s => s.id === storedStoreId);
        if (store) {
          setSelectedStore(store);
        } else if (userStores.length > 0) {
          // If stored store not found, select first active store
          const activeStore = userStores.find(s => s.is_active !== false && !s.deleted_at) || userStores[0];
          setSelectedStore(activeStore);
          localStorage.setItem('selectedStoreId', activeStore.id);
        }
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeStore = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    if (store) {
      setSelectedStore(store);
      localStorage.setItem('selectedStoreId', storeId);
      loadStoreFeatures(storeId);
    }
  };

  const loadStoreFeatures = async (storeId) => {
    if (!storeId || user?.role === 'super_admin') {
      setEnabledFeatures([]);
      setFeaturesLoading(false);
      return;
    }
    
    try {
      setFeaturesLoading(true);
      const response = await storeTemplatesAPI.getStoreFeatures(storeId);
      setEnabledFeatures(response.data.enabled_features || []);
    } catch (error) {
      console.error('Error loading store features:', error);
      // On error, show all features (fail open) so navigation doesn't disappear
      setEnabledFeatures(['revenue', 'expenses', 'purchase_payments', 'payroll', 'recurring_expenses', 'lottery', 'general_ledger', 'reports']);
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      loadStoreFeatures(selectedStore.id);
    }
  }, [selectedStore]);

  const hasMultipleStores = stores.filter(s => s.is_active !== false && !s.deleted_at).length > 1;

  // Helper function to check if a feature is enabled
  const isFeatureEnabled = (featureKey) => {
    if (!featureKey) return true; // Items without feature requirement always show
    if (!selectedStore || user?.role === 'super_admin') return true; // Super admin sees everything
    // While loading, show all features (fail open) to prevent navigation disappearing
    if (featuresLoading) return true;
    return enabledFeatures.includes(featureKey);
  };

  const value = {
    stores,
    selectedStore,
    changeStore,
    hasMultipleStores,
    loading,
    reloadStores: loadStores,
    enabledFeatures,
    isFeatureEnabled,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

