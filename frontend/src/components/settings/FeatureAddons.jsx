import { useState, useEffect } from 'react';
import { storeSubscriptionsAPI } from '../../services/api';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';

const ADDON_FEATURE_KEYS = ['manager_access', 'handheld_devices', 'license_management'];

const FeatureAddons = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [availableAddons, setAvailableAddons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedStore) {
      loadData();
    }
  }, [selectedStore]);

  const loadData = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    try {
      const [subscriptionRes, addonsRes] = await Promise.all([
        storeSubscriptionsAPI.getByStore(selectedStore.id),
        storeSubscriptionsAPI.getAvailableAddons(selectedStore.id)
      ]);
      setSubscription(subscriptionRes.data.subscription);
      const filteredAddons = (addonsRes.data.available_addons || []).filter((addon) =>
        ADDON_FEATURE_KEYS.includes(addon.feature_key)
      );
      setAvailableAddons(filteredAddons);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading subscription data: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddon = async (featureKey) => {
    if (!window.confirm('Are you sure you want to add this feature? It will be added to your monthly subscription cost.')) {
      return;
    }

    try {
      await storeSubscriptionsAPI.addAddon(selectedStore.id, featureKey);
      alert('Feature addon added successfully!');
      loadData();
    } catch (error) {
      alert('Error adding feature: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRemoveAddon = async (featureKey) => {
    if (!window.confirm('Are you sure you want to remove this feature addon?')) {
      return;
    }

    try {
      await storeSubscriptionsAPI.removeAddon(selectedStore.id, featureKey);
      alert('Feature addon removed successfully!');
      loadData();
    } catch (error) {
      alert('Error removing feature: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d8659]"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <p>No subscription found for this store. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  const templateFeatures = subscription.template_feature_keys || [];
  const addonFeatures = subscription.addon_feature_keys || [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Feature Addons</h2>
        <p className="text-gray-600 mt-1">
          Add individual features to your plan for additional monthly fees
        </p>
      </div>

      {/* Current Subscription Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Plan</p>
            <p className="text-lg font-medium text-gray-900">
              {subscription.template_name || 'No Template'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Cost</p>
            <p className="text-lg font-medium text-blue-600">
              ${parseFloat(subscription.total_monthly_price || 0).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-500 mb-2">Breakdown:</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Plan Base Price:</span>
              <span className="font-medium">${parseFloat(subscription.base_price || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Feature Addons:</span>
              <span className="font-medium">${parseFloat(subscription.feature_addons_total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Total:</span>
              <span className="text-blue-600">${parseFloat(subscription.total_monthly_price || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Included in Plan */}
      {subscription.features && subscription.features.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Features Included in Your Plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {subscription.features.map((feature) => (
              <div
                key={feature.feature_key}
                className={`p-3 rounded border ${
                  feature.is_addon 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-green-300 bg-green-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{feature.feature_name}</p>
                    {feature.is_addon && (
                      <p className="text-xs text-blue-600 mt-1">
                        Addon: +${parseFloat(feature.price_per_month || feature.feature_price || 0).toFixed(2)}/mo
                      </p>
                    )}
                  </div>
                  {feature.is_addon && (
                    <button
                      onClick={() => handleRemoveAddon(feature.feature_key)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Addons */}
      {availableAddons.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Available Feature Addons
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            These features are not included in your current plan. Add them individually for the listed price.
          </p>
          <div className="space-y-3">
            {availableAddons.map((addon) => (
              <div
                key={addon.feature_key}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{addon.feature_name}</h4>
                  {addon.feature_description && (
                    <p className="text-sm text-gray-600 mt-1">{addon.feature_description}</p>
                  )}
                  <p className="text-sm text-blue-600 font-medium mt-2">
                    ${parseFloat(addon.price_per_month || 0).toFixed(2)}/month
                  </p>
                </div>
                <button
                  onClick={() => handleAddAddon(addon.feature_key)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Feature
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center">
            All available features are already included in your plan or have been added as addons.
          </p>
        </div>
      )}
    </div>
  );
};

export default FeatureAddons;

