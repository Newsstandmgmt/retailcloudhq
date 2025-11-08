import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storesAPI, storeTemplatesAPI, adminManagementAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Stores = () => {
  const [stores, setStores] = useState([]);
  const [sortedStores, setSortedStores] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]); // Subscriptions (formerly templates)
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'admin', 'status'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [storeToUpdateSubscription, setStoreToUpdateSubscription] = useState(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState('');
  const [showAssignAdminModal, setShowAssignAdminModal] = useState(false);
  const [storeToAssignAdmin, setStoreToAssignAdmin] = useState(null);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadStores();
    if (user?.role === 'super_admin') {
      loadSubscriptions();
      loadAdmins();
    }
  }, [user]);

  useEffect(() => {
    sortStores();
  }, [stores, sortBy]);

  const loadStores = async () => {
    try {
      const response = await storesAPI.getAll();
      // Filter out deleted stores (deleted_at IS NOT NULL) - backend should already filter, but this is a safety check
      const allStores = response.data.stores || [];
      const activeStores = allStores.filter(store => !store.deleted_at);
      setStores(activeStores);
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const response = await storeTemplatesAPI.getAll();
      setSubscriptions(response.data.templates || []); // API returns templates, but they are subscriptions
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const response = await adminManagementAPI.getUsersByRole('admin');
      setAdmins(response.data.users || []);
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const sortStores = () => {
    const sorted = [...stores];
    switch (sortBy) {
      case 'admin':
        sorted.sort((a, b) => {
          const aAdmin = a.admin_first_name && a.admin_last_name 
            ? `${a.admin_last_name}, ${a.admin_first_name}`.toLowerCase()
            : 'zzz_no_admin';
          const bAdmin = b.admin_first_name && b.admin_last_name
            ? `${b.admin_last_name}, ${b.admin_first_name}`.toLowerCase()
            : 'zzz_no_admin';
          return aAdmin.localeCompare(bAdmin);
        });
        break;
      case 'status':
        sorted.sort((a, b) => {
          // Active first, then deactivated (deleted stores should already be filtered out)
          const aStatus = a.is_active === true ? 0 : 1;
          const bStatus = b.is_active === true ? 0 : 1;
          return aStatus - bStatus;
        });
        break;
      case 'name':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    setSortedStores(sorted);
  };

  const handleAssignSubscription = (store) => {
    setStoreToUpdateSubscription(store);
    setSelectedSubscriptionId(store.template_id || '');
    setShowSubscriptionModal(true);
  };

  const confirmAssignSubscription = async () => {
    if (!storeToUpdateSubscription || !selectedSubscriptionId) {
      alert('Please select a subscription plan');
      return;
    }

    try {
      // Update store with subscription (template_id is the subscription plan ID)
      await storesAPI.update(storeToUpdateSubscription.id, { template_id: selectedSubscriptionId });
      
      // Ensure auto-renew is enabled in subscription (this is handled by the backend)
      // The subscription is automatically created/updated with auto_renew=true
      
      alert('Subscription assigned successfully! Auto-renewal is enabled. The subscription will automatically renew on the billing date.');
      setShowSubscriptionModal(false);
      setStoreToUpdateSubscription(null);
      setSelectedSubscriptionId('');
      // Reload after a short delay to ensure DB is updated
      setTimeout(() => {
        loadStores();
      }, 1000);
    } catch (error) {
      alert('Error assigning subscription: ' + (error.response?.data?.error || error.message));
    }
  };

  const getSubscriptionName = (subscriptionId) => {
    if (!subscriptionId) return 'No Subscription';
    const subscription = subscriptions.find(s => s.id === subscriptionId);
    return subscription ? subscription.name : 'Unknown Subscription';
  };

  const handleToggleActive = async (storeId, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this store? ${currentStatus ? 'The store will remain visible but marked as inactive.' : ''}`)) {
      return;
    }

    try {
      const response = await storesAPI.toggleActive(storeId);
      // Reload stores to show updated status (deactivated stores should still be visible)
      await loadStores();
    } catch (error) {
      alert('Error updating store: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = (storeId, storeName) => {
    setStoreToDelete({ id: storeId, name: storeName });
    setShowDeleteConfirm(true);
    setDeleteConfirmText('');
  };

  const confirmDelete = async () => {
    if (deleteConfirmText !== 'Delete') {
      alert('Please type "Delete" exactly to confirm deletion.');
      return;
    }

    try {
      await storesAPI.delete(storeToDelete.id);
      alert('Store deleted successfully! You can restore it later.');
      setShowDeleteConfirm(false);
      setStoreToDelete(null);
      setDeleteConfirmText('');
      loadStores();
    } catch (error) {
      alert('Error deleting store: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAssignAdmin = (store) => {
    setStoreToAssignAdmin(store);
    setSelectedAdminId(store.admin_id || '');
    setShowAssignAdminModal(true);
  };

  const confirmAssignAdmin = async () => {
    if (!storeToAssignAdmin) {
      return;
    }

    try {
      // Only update admin_id and created_by - all other store data remains intact
      await storesAPI.update(storeToAssignAdmin.id, { 
        admin_id: selectedAdminId || null,
        created_by: selectedAdminId || null // Update created_by to match admin_id
        // Note: We're only updating ownership fields, all store data (revenue, invoices, expenses, etc.) remains unchanged
      });
      alert('Admin assigned successfully! All store data has been preserved.');
      setShowAssignAdminModal(false);
      setStoreToAssignAdmin(null);
      setSelectedAdminId('');
      loadStores();
    } catch (error) {
      alert('Error assigning admin: ' + (error.response?.data?.error || error.message));
    }
  };

  const getAdminName = (adminId) => {
    if (!adminId) return 'No admin assigned';
    const admin = admins.find(a => a.id === adminId);
    return admin ? `${admin.first_name} ${admin.last_name}` : 'Unknown admin';
  };

  if (loading) {
    return <div className="text-center py-8">Loading stores...</div>;
  }

  const canManage = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
          <p className="text-gray-600">Manage your retail locations</p>
        </div>
        {canManage && (
          <Link
            to="/stores/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Store
          </Link>
        )}
      </div>

      {stores.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No stores found.</p>
          {canManage && (
            <Link
              to="/stores/new"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first store
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {user?.role === 'super_admin' && (
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Sort by:
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="name">Store Name</option>
                  <option value="admin">Assigned Admin</option>
                  <option value="status">Status</option>
                </select>
              </label>
            </div>
          )}
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                {user?.role === 'super_admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                {user?.role === 'super_admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Admin
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStores.map((store) => (
                <tr key={store.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/stores/${store.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {store.name}
                    </Link>
                  </td>
                  {user?.role === 'super_admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col gap-1">
                        <span className={store.template_id ? 'text-gray-900 font-medium' : 'text-yellow-600'}>
                          {getSubscriptionName(store.template_id)}
                        </span>
                        {store.template_id && subscriptions.find(s => s.id === store.template_id) && (
                          <span className="text-xs text-gray-400">
                            ${parseFloat(subscriptions.find(s => s.id === store.template_id)?.price_per_month || 0).toFixed(2)}/{subscriptions.find(s => s.id === store.template_id)?.billing_cycle}
                          </span>
                        )}
                        <button
                          onClick={() => handleAssignSubscription(store)}
                          className="text-blue-600 hover:text-blue-800 text-xs underline"
                        >
                          Change
                        </button>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {store.city && store.state ? `${store.city}, ${store.state}` : 'N/A'}
                  </td>
                  {user?.role === 'super_admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {store.admin_id && store.admin_first_name && store.admin_last_name ? (
                        <div>
                          <Link
                            to={store.admin_id ? `/admin-management/${store.admin_id}` : '#'}
                            onClick={(e) => {
                              if (!store.admin_id) {
                                e.preventDefault();
                                alert('No admin assigned to this store.');
                              }
                            }}
                            className="font-medium text-blue-600 hover:text-blue-800"
                          >
                            {store.admin_first_name} {store.admin_last_name}
                          </Link>
                          <div className="text-xs text-gray-500">
                            {store.admin_email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No admin assigned</span>
                      )}
                      <button
                        onClick={() => handleAssignAdmin(store)}
                        className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        {store.admin_id ? 'Change' : 'Assign'}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        store.is_active === true
                          ? 'bg-green-100 text-green-800'
                          : store.is_active === false
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {store.is_active === true ? 'Active' : store.is_active === false ? 'Deactivated' : 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Link
                        to={`/stores/${store.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                      {(user?.role === 'super_admin' || user?.role === 'admin') && (
                        <Link
                          to={`/stores/${store.id}/integrations`}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          Integrations
                        </Link>
                      )}
                      {canManage && (
                        <>
                          <Link
                            to={`/stores/${store.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleToggleActive(store.id, store.is_active === true)}
                            className={store.is_active === true ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}
                          >
                            {store.is_active === true ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                      {user?.role === 'super_admin' && (
                        <button
                          onClick={() => handleDelete(store.id, store.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && storeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-red-600 mb-4">Delete Store</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete <strong>"{storeToDelete.name}"</strong>?
            </p>
            <p className="text-sm text-gray-600 mb-4">
              This will hide the store from admins and managers. You can restore it later.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <strong className="text-red-600">Delete</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type Delete here"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setStoreToDelete(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmText !== 'Delete'}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Store
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Assignment Modal */}
      {showSubscriptionModal && storeToUpdateSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Assign Subscription to {storeToUpdateSubscription.name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Subscription Plan *
                </label>
                <select
                  value={selectedSubscriptionId}
                  onChange={(e) => setSelectedSubscriptionId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="">Select a subscription plan...</option>
                  {subscriptions.map(subscription => (
                    <option key={subscription.id} value={subscription.id}>
                      {subscription.name} - ${parseFloat(subscription.price_per_month || 0).toFixed(2)}/{subscription.billing_cycle}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedSubscriptionId && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    Selected Plan: {subscriptions.find(s => s.id === selectedSubscriptionId)?.name}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-blue-800 mb-3">
                    <div>
                      <strong>Price:</strong> ${parseFloat(subscriptions.find(s => s.id === selectedSubscriptionId)?.price_per_month || 0).toFixed(2)}/{subscriptions.find(s => s.id === selectedSubscriptionId)?.billing_cycle}
                    </div>
                    <div>
                      <strong>Features:</strong> {subscriptions.find(s => s.id === selectedSubscriptionId)?.feature_keys?.length || 0} included
                    </div>
                  </div>
                  {subscriptions.find(s => s.id === selectedSubscriptionId)?.feature_keys && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-blue-800 mb-1">Included Features:</p>
                      <div className="flex flex-wrap gap-1">
                        {subscriptions.find(s => s.id === selectedSubscriptionId).feature_keys.slice(0, 5).map(featureKey => (
                          <span key={featureKey} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {featureKey.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {subscriptions.find(s => s.id === selectedSubscriptionId).feature_keys.length > 5 && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            +{subscriptions.find(s => s.id === selectedSubscriptionId).feature_keys.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="auto-renew"
                    defaultChecked
                    disabled
                    className="mt-1"
                  />
                  <label htmlFor="auto-renew" className="text-sm text-green-800">
                    <strong>Auto-Renew Subscription</strong>
                    <p className="text-xs text-green-700 mt-1">
                      Automatically renew this subscription on the billing date. The store owner will be billed automatically.
                    </p>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowSubscriptionModal(false);
                  setStoreToUpdateSubscription(null);
                  setSelectedSubscriptionId('');
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAssignSubscription}
                disabled={!selectedSubscriptionId}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign Subscription & Enable Auto-Renew
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Admin Modal */}
      {showAssignAdminModal && storeToAssignAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {storeToAssignAdmin.admin_id ? 'Reassign' : 'Assign'} Admin to {storeToAssignAdmin.name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Admin
                </label>
                <select
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No admin (unassign)</option>
                  {admins.map(admin => (
                    <option key={admin.id} value={admin.id}>
                      {admin.first_name} {admin.last_name} ({admin.email})
                    </option>
                  ))}
                </select>
              </div>
              
              {storeToAssignAdmin.admin_id && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Current Admin:</strong> {getAdminName(storeToAssignAdmin.admin_id)}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAssignAdminModal(false);
                  setStoreToAssignAdmin(null);
                  setSelectedAdminId('');
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAssignAdmin}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {storeToAssignAdmin.admin_id ? 'Reassign Admin' : 'Assign Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stores;

