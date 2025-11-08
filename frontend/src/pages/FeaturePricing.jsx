import { useState, useEffect } from 'react';
import { featurePricingAPI, storeTemplatesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const FeaturePricing = () => {
  const { user } = useAuth();
  const [pricing, setPricing] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingFeature, setEditingFeature] = useState(null);
  const [priceForm, setPriceForm] = useState({
    price_per_month: '',
    is_active: true
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [pricingRes, featuresRes] = await Promise.all([
        featurePricingAPI.getAll(),
        storeTemplatesAPI.getFeatures()
      ]);
      
      // Merge pricing with features
      const pricingData = pricingRes.data.pricing || [];
      const featuresData = featuresRes.data.features || [];
      
      // Create a map of pricing by feature key
      const pricingMap = {};
      pricingData.forEach(p => {
        pricingMap[p.feature_key] = p;
      });
      
      // Combine features with their pricing
      const combined = featuresData.map(feature => ({
        ...feature,
        price: pricingMap[feature.feature_key] || null,
        price_per_month: pricingMap[feature.feature_key]?.price_per_month || 0
      }));
      
      setPricing(combined);
      setFeatures(featuresData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading feature pricing: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const ensureLicenseManagementFeature = async () => {
    try {
      // Check if license_management feature exists
      const featuresRes = await storeTemplatesAPI.getFeatures();
      const hasLicenseManagement = featuresRes.data.features?.some(
        f => f.feature_key === 'license_management'
      );
      
      if (!hasLicenseManagement) {
        // Create the feature if it doesn't exist
        await storeTemplatesAPI.createFeature({
          feature_key: 'license_management',
          feature_name: 'License Management',
          description: 'Manage store licenses, expiration dates, renewals, and reminders',
          category: 'operations'
        });
        // Reload data to show the new feature
        loadData();
      }
    } catch (error) {
      console.error('Error ensuring license_management feature:', error);
      // Don't show error to user - it's just a background check
    }
  };

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadData();
      // Ensure license_management feature exists
      ensureLicenseManagementFeature();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleEdit = (feature) => {
    setEditingFeature(feature);
    setPriceForm({
      price_per_month: feature.price?.price_per_month || feature.price_per_month || '0.00',
      is_active: feature.price?.is_active !== false
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!editingFeature) return;

    try {
      await featurePricingAPI.upsert(editingFeature.feature_key, {
        price_per_month: parseFloat(priceForm.price_per_month),
        is_active: priceForm.is_active
      });
      alert('Feature pricing updated successfully!');
      setEditingFeature(null);
      setPriceForm({ price_per_month: '', is_active: true });
      loadData();
    } catch (error) {
      alert('Error saving pricing: ' + (error.response?.data?.error || error.message));
    }
  };

  const groupByCategory = () => {
    const grouped = {};
    pricing.forEach(item => {
      const category = item.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d8659]"></div>
        <p className="mt-4 text-gray-600">Loading feature pricing...</p>
      </div>
    );
  }

  const grouped = groupByCategory();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feature Pricing</h1>
        <p className="text-gray-600 mt-1">Set pricing for each feature that can be added to stores</p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 uppercase">{category}</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {items.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{item.feature_name}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ${parseFloat(item.price_per_month || 0).toFixed(2)}
                        <span className="text-xs text-gray-500 ml-1">/month</span>
                      </div>
                      {item.price && !item.price.is_active && (
                        <span className="text-xs text-red-500">Inactive</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleEdit(item)}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                    >
                      {item.price ? 'Edit' : 'Set Price'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingFeature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Set Pricing for {editingFeature.feature_name}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price per Month ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceForm.price_per_month}
                  onChange={(e) => setPriceForm({ ...priceForm, price_per_month: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={priceForm.is_active}
                  onChange={(e) => setPriceForm({ ...priceForm, is_active: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setEditingFeature(null);
                    setPriceForm({ price_per_month: '', is_active: true });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Pricing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeaturePricing;

