import { useState, useEffect } from 'react';
import { storeTemplatesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Subscriptions page - Templates and Subscriptions are the same thing
// Each subscription plan is a template with pricing and features

const Subscriptions = () => {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_per_month: '',
    billing_cycle: 'monthly',
    feature_ids: []
  });

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subscriptionsRes, featuresRes] = await Promise.all([
        storeTemplatesAPI.getAll(),
        storeTemplatesAPI.getFeatures()
      ]);
      setSubscriptions(subscriptionsRes.data.templates || []);
      setFeatures(featuresRes.data.features || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading subscriptions: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({ 
      name: '', 
      description: '', 
      price_per_month: '',
      billing_cycle: 'monthly',
      feature_ids: [] 
    });
    setShowCreateModal(true);
  };

  const handleEdit = async (subscription) => {
    try {
      // Fetch full subscription details with features
      const response = await storeTemplatesAPI.getById(subscription.id);
      const fullSubscription = response.data.template;
      
      setEditingSubscription(fullSubscription);
      setFormData({
        name: fullSubscription.name,
        description: fullSubscription.description || '',
        price_per_month: fullSubscription.price_per_month || '',
        billing_cycle: fullSubscription.billing_cycle || 'monthly',
        feature_ids: fullSubscription.features?.map(f => f.id) || []
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Error loading subscription:', error);
      alert('Error loading subscription details: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleFeatureToggle = (featureId) => {
    setFormData(prev => {
      const featureIds = prev.feature_ids || [];
      if (featureIds.includes(featureId)) {
        return { ...prev, feature_ids: featureIds.filter(id => id !== featureId) };
      } else {
        return { ...prev, feature_ids: [...featureIds, featureId] };
      }
    });
  };

  const handleDelete = (subscription) => {
    setSubscriptionToDelete(subscription);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!subscriptionToDelete) return;

    try {
      await storeTemplatesAPI.delete(subscriptionToDelete.id);
      alert('Subscription deleted successfully!');
      setShowDeleteConfirm(false);
      setSubscriptionToDelete(null);
      loadData();
    } catch (error) {
      alert('Error deleting subscription: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Subscription name is required');
      return;
    }

    if (!formData.price_per_month || parseFloat(formData.price_per_month) < 0) {
      alert('Valid price per month is required');
      return;
    }

    try {
      if (editingSubscription) {
        await storeTemplatesAPI.update(editingSubscription.id, {
          name: formData.name,
          description: formData.description,
          price_per_month: formData.price_per_month,
          billing_cycle: formData.billing_cycle,
          feature_ids: formData.feature_ids
        });
        alert('Subscription updated successfully!');
      } else {
        await storeTemplatesAPI.create({
          name: formData.name,
          description: formData.description,
          price_per_month: formData.price_per_month,
          billing_cycle: formData.billing_cycle,
          feature_ids: formData.feature_ids
        });
        alert('Subscription created successfully!');
      }
      
      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingSubscription(null);
      setFormData({ 
        name: '', 
        description: '', 
        price_per_month: '',
        billing_cycle: 'monthly',
        feature_ids: [] 
      });
      loadData();
    } catch (error) {
      console.error('Error saving subscription:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Unknown error';
      alert('Error saving subscription: ' + errorMessage);
    }
  };

  const groupFeaturesByCategory = () => {
    const grouped = {};
    features.forEach(feature => {
      const category = feature.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(feature);
    });
    return grouped;
  };

  const groupedFeatures = groupFeaturesByCategory();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d8659]"></div>
        <p className="mt-4 text-gray-600">Loading subscriptions...</p>
      </div>
    );
  }

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Access denied. Only Super Admin can access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-gray-600 mt-1">Manage subscription plans and their features</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create Subscription
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No subscriptions found.</p>
          <button
            onClick={handleCreate}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first subscription plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subscriptions.map((subscription) => (
            <div key={subscription.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{subscription.name}</h3>
                  {subscription.description && (
                    <p className="text-sm text-gray-600 mt-1">{subscription.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(subscription)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(subscription)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2">
                  <p className="text-lg font-bold text-blue-600">
                    ${parseFloat(subscription.price_per_month || 0).toFixed(2)}
                    <span className="text-sm text-gray-500 ml-1 capitalize">/{subscription.billing_cycle || 'month'}</span>
                  </p>
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                  Included Features ({subscription.feature_keys?.length || 0})
                </p>
                <div className="flex flex-wrap gap-2">
                  {subscription.feature_keys?.slice(0, 5).map((featureKey) => {
                    const feature = features.find(f => f.feature_key === featureKey);
                    return (
                      <span
                        key={featureKey}
                        className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                      >
                        {feature?.feature_name || featureKey.replace(/_/g, ' ')}
                      </span>
                    );
                  })}
                  {subscription.feature_keys?.length > 5 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      +{subscription.feature_keys.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingSubscription ? 'Edit Subscription' : 'Create New Subscription'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Gas Station Plan, C-Store Plan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Describe what this subscription includes..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price per Month ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_per_month}
                    onChange={(e) => setFormData({ ...formData, price_per_month: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="29.99"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Cycle *
                  </label>
                  <select
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Features *
                </label>
                <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4">
                  {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                    <div key={category} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {categoryFeatures.map((feature) => (
                          <label
                            key={feature.id}
                            className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.feature_ids.includes(feature.id)}
                              onChange={() => handleFeatureToggle(feature.id)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{feature.feature_name}</div>
                              {feature.description && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {feature.description}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.feature_ids.length} feature(s) selected
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setEditingSubscription(null);
                    setFormData({ 
                      name: '', 
                      description: '', 
                      price_per_month: '',
                      billing_cycle: 'monthly',
                      feature_ids: [] 
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingSubscription ? 'Update Subscription' : 'Create Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && subscriptionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-red-600 mb-4">Delete Subscription</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete <strong>"{subscriptionToDelete.name}"</strong>?
            </p>
            <p className="text-sm text-gray-600 mb-4">
              This will deactivate the subscription. Stores using this subscription will need to be reassigned.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSubscriptionToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;

