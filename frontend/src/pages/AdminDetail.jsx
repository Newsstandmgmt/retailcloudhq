import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminManagementAPI, storesAPI, usersAPI, storeManagersAPI, storeSubscriptionsAPI, storeTemplatesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AdminDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [admin, setAdmin] = useState(null);
  const [stores, setStores] = useState([]);
  const [deletedStores, setDeletedStores] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showAssignManagerModal, setShowAssignManagerModal] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showAssignStoreModal, setShowAssignStoreModal] = useState(false);
  const [newlyCreatedManager, setNewlyCreatedManager] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showStoreSubscriptionModal, setShowStoreSubscriptionModal] = useState(false);
  const [storeSubscriptions, setStoreSubscriptions] = useState({}); // { storeId: subscription }
  const [storeManagers, setStoreManagers] = useState({}); // { storeId: [managers] }
  const [templates, setTemplates] = useState([]);
  const [selectedStoreForSubscription, setSelectedStoreForSubscription] = useState(null);
  const [editingManager, setEditingManager] = useState(null); // { storeId, managerId, permissions }
  const [storeSubscriptionForm, setStoreSubscriptionForm] = useState({
    template_id: '',
    billing_cycle: 'monthly',
    auto_renew: true
  });
  const [discountForm, setDiscountForm] = useState({
    discount_percentage: 0,
    discount_amount: 0,
    discount_applied_to_next_billing: true,
    discount_start_date: new Date().toISOString().split('T')[0],
    discount_end_date: ''
  });
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'admin',
    phone: ''
  });
  const [storeForm, setStoreForm] = useState({
    name: '',
    store_type: 'galaxy',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: ''
  });
  const [selectedStore, setSelectedStore] = useState(null);

  useEffect(() => {
    if (!user) {
      // User not loaded yet, wait
      return;
    }
    
    if (user.role !== 'super_admin') {
      // User is loaded but not super admin
      setLoading(false);
      return;
    }
    
    if (!userId || userId === 'undefined') {
      console.error('AdminDetail: userId is missing from route params');
      setError('Admin ID is missing from the URL. Please navigate back and try again.');
      setLoading(false);
      return;
    }
    
    loadAdminData();
  }, [userId, user]);

  const loadAdminData = async () => {
    // Double-check userId before making any API calls
    if (!userId || userId === 'undefined') {
      console.error('AdminDetail: userId is undefined or invalid');
      setError('Admin ID is missing. Please navigate back and try again.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const [adminRes, storesRes, managersRes, templatesRes] = await Promise.all([
        adminManagementAPI.getAdminConfig(userId),
        adminManagementAPI.getAdminStores(userId, true), // Include inactive stores
        adminManagementAPI.getUsersByRole('manager'),
        storeTemplatesAPI.getAll()
      ]);
      
      setAdmin(adminRes.data);
      const allStores = storesRes.data.stores || [];
      // Separate stores: active/deactivated vs deleted
      // Deleted stores have deleted_at set (not null)
      // Show all stores where deleted_at is null (includes both active and deactivated)
      const activeStores = allStores.filter(s => s.deleted_at === null || s.deleted_at === undefined);
      setStores(activeStores);
      setDeletedStores(allStores.filter(s => s.deleted_at !== null && s.deleted_at !== undefined));
      
      // Filter managers created by this admin
      const allManagers = managersRes.data.users || [];
      const adminManagers = allManagers.filter(m => {
        // Managers created by this admin
        return m.created_by === userId;
      });
      setManagers(adminManagers);
      
      setTemplates(templatesRes.data.templates || []);
      
      // Load subscriptions and managers for each store
      const subscriptionsMap = {};
      const managersMap = {};
      for (const store of activeStores) {
        try {
          const subRes = await storeSubscriptionsAPI.getByStore(store.id);
          // Handle both null and undefined responses
          if (subRes.data && subRes.data.subscription) {
            subscriptionsMap[store.id] = subRes.data.subscription;
          } else {
            subscriptionsMap[store.id] = null;
          }
        } catch (error) {
          // Store might not have subscription yet - check if it's a 404 or 500
          if (error.response?.status === 404 || error.response?.status === 500) {
            // 500 might mean subscription doesn't exist, treat as null
            subscriptionsMap[store.id] = null;
          } else {
            console.error(`Error loading subscription for store ${store.id}:`, error);
            subscriptionsMap[store.id] = null;
          }
        }
        
        // Load managers for this store
        try {
          const managersRes = await storeManagersAPI.getByStore(store.id);
          managersMap[store.id] = managersRes.data.managers || [];
        } catch (error) {
          console.error(`Error loading managers for store ${store.id}:`, error);
          managersMap[store.id] = [];
        }
      }
      setStoreSubscriptions(subscriptionsMap);
      setStoreManagers(managersMap);
      setLoading(false);
    } catch (error) {
      console.error('Error loading admin data:', error);
      console.error('Error details:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load admin data';
      setError(`Error loading admin data: ${errorMessage}`);
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      let createdUser;
      if (userForm.role === 'admin') {
        const response = await usersAPI.create(userForm);
        createdUser = response.data.user;
        alert('Admin user created successfully!');
      } else if (userForm.role === 'manager') {
        const response = await usersAPI.create({
          ...userForm,
          created_by: userId
        });
        createdUser = response.data.user;
        // If manager, show store assignment modal
        setNewlyCreatedManager(createdUser);
        setShowCreateUserModal(false);
        setShowAssignStoreModal(true);
        setUserForm({
          email: '',
          password: '',
          first_name: '',
          last_name: '',
          role: 'admin',
          phone: ''
        });
        return; // Don't reload yet, wait for store assignment
      }
      setShowCreateUserModal(false);
      setUserForm({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'admin',
        phone: ''
      });
      loadAdminData();
    } catch (error) {
      alert('Error creating user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAssignStoreToNewManager = async (e) => {
    e.preventDefault();
    const storeId = e.target.store_id.value;
    if (!storeId) {
      alert('Please select a store');
      return;
    }

    try {
      await storeManagersAPI.assign(storeId, newlyCreatedManager.id, {
        can_edit: true,
        can_view_reports: true,
        can_manage_employees: false
      });
      alert('Manager assigned to store successfully!');
      setShowAssignStoreModal(false);
      setNewlyCreatedManager(null);
      loadAdminData();
    } catch (error) {
      alert('Error assigning manager: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      await usersAPI.resetPassword(userId);
      alert('Password reset successfully! New password: Retail$2025');
      loadAdminData();
    } catch (error) {
      alert('Error resetting password: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      await usersAPI.changePassword(selectedUserForPassword.id, passwordForm.newPassword);
      alert('Password changed successfully!');
      setShowPasswordModal(false);
      setSelectedUserForPassword(null);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      alert('Error changing password: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAssignManager = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }
    
    const managerId = e.target.manager_id.value;
    if (!managerId) {
      alert('Please select a manager');
      return;
    }

    // Check if store has manager_access feature addon
    const subscription = storeSubscriptions[selectedStore];
    const hasManagerAccess = subscription?.addon_feature_keys?.includes('manager_access') || 
                             subscription?.features?.some(f => f.feature_key === 'manager_access' && f.is_addon);
    
    if (!hasManagerAccess) {
      alert('Manager Access feature addon is required. Please add "Manager Access" feature addon to this store\'s subscription first. You can do this in the Feature Addons section of Settings.');
      return;
    }

    try {
      await storeManagersAPI.assign(selectedStore, managerId, {
        can_edit: true,
        can_view_reports: true,
        can_manage_employees: false
      });
      alert('Manager assigned successfully!');
      setShowAssignManagerModal(false);
      setSelectedStore(null);
      loadAdminData();
    } catch (error) {
      alert('Error assigning manager: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRemoveManager = async (storeId, managerId) => {
    if (!confirm('Are you sure you want to remove this manager from the store?')) {
      return;
    }

    try {
      await storeManagersAPI.remove(storeId, managerId);
      alert('Manager removed successfully!');
      loadAdminData();
    } catch (error) {
      alert('Error removing manager: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateManagerPermissions = async (storeId, managerId, permissions) => {
    try {
      // Update manager permissions by removing and re-adding with new permissions
      await storeManagersAPI.remove(storeId, managerId);
      await storeManagersAPI.assign(storeId, managerId, permissions);
      alert('Manager permissions updated successfully!');
      setEditingManager(null);
      loadAdminData();
    } catch (error) {
      alert('Error updating manager permissions: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => navigate('/admin-management')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Admin Management
        </button>
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

  if (!admin) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          Admin not found.
        </div>
      </div>
    );
  }

  const adminUser = admin.user || admin;
  
  // Get managers created by this admin
  const adminManagers = managers.filter(m => m.created_by === userId);

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin-management')}
          className="mb-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to Admin Management
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Admin: {adminUser.first_name} {adminUser.last_name}
        </h1>
        <p className="text-gray-600 mt-1">{adminUser.email}</p>
      </div>

      {/* Admin Info */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Admin Information</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedUserForPassword(adminUser);
                setPasswordForm({ newPassword: '', confirmPassword: '' });
                setShowPasswordModal(true);
              }}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Change Password
            </button>
            <button
              onClick={() => handleResetPassword(adminUser.id)}
              className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Reset Password
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <p className="font-medium">{adminUser.email}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Password</label>
            <p className="font-medium font-mono text-xs">••••••••</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Max Stores</label>
            <p className="font-medium">{admin.config?.max_stores === null ? 'Unlimited' : admin.config?.max_stores}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Status</label>
            <p className="font-medium">{adminUser.is_active ? 'Active' : 'Inactive'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Stores Created</label>
            <p className="font-medium">{stores.length}</p>
          </div>
        </div>
      </div>


      {/* Create User Section */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create User</h2>
          <button
            onClick={() => setShowCreateUserModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create Admin or Manager
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Create new admin users or managers for this admin account.
        </p>
      </div>

      {/* Stores Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Stores ({stores.length})</h2>
            {deletedStores.length > 0 && (
              <button
                onClick={() => setShowDeleted(!showDeleted)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                {showDeleted ? 'Hide' : 'Show'} Deleted ({deletedStores.length})
              </button>
            )}
          </div>
          <button
            onClick={() => setShowCreateStoreModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Add Store for Admin
          </button>
        </div>
        <div className="p-6">
          {stores.length === 0 && deletedStores.length === 0 ? (
            <p className="text-gray-500">No stores found for this admin</p>
          ) : (
            <div className="space-y-4">
              {stores.map((store) => (
                <div key={store.id} className={`border rounded-lg p-4 ${
                  store.is_active === false ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{store.name}</h3>
                        {store.is_active === false && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Deactivated
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {store.address}, {store.city}, {store.state} {store.zip_code}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Phone: {store.phone || 'N/A'}
                      </p>
                      {/* Store Subscription Info */}
                      {/* Template and Subscription are the same - if template_id is set, subscription is active */}
                      {store.template_id ? (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">
                              Subscription: {storeSubscriptions[store.id]?.template_name || store.template_name || templates.find(t => t.id === store.template_id)?.name || 'Active Plan'}
                            </span>
                            <button
                              onClick={async () => {
                                setSelectedStoreForSubscription(store);
                                const sub = storeSubscriptions[store.id];
                                
                                // If subscription record doesn't exist but template_id is set, auto-create it
                                if (!sub && store.template_id) {
                                  try {
                                    const selectedTemplate = templates.find(t => t.id === store.template_id);
                                    await storeSubscriptionsAPI.create(store.id, {
                                      template_id: store.template_id,
                                      billing_cycle: selectedTemplate?.billing_cycle || 'monthly',
                                      auto_renew: true,
                                      start_date: new Date().toISOString().split('T')[0]
                                    });
                                    // Reload data to get the new subscription
                                    await loadAdminData();
                                  } catch (error) {
                                    console.error('Error auto-creating subscription:', error);
                                  }
                                }
                                
                                const updatedSub = storeSubscriptions[store.id];
                                setStoreSubscriptionForm({
                                  template_id: updatedSub?.template_id || store.template_id || '',
                                  billing_cycle: updatedSub?.billing_cycle || templates.find(t => t.id === store.template_id)?.billing_cycle || 'monthly',
                                  auto_renew: updatedSub?.auto_renew !== false
                                });
                                setDiscountForm({
                                  discount_percentage: updatedSub?.discount_percentage || 0,
                                  discount_amount: updatedSub?.discount_amount || 0,
                                  discount_applied_to_next_billing: updatedSub?.discount_applied_to_next_billing || false,
                                  discount_start_date: updatedSub?.discount_start_date ? new Date(updatedSub.discount_start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                  discount_end_date: updatedSub?.discount_end_date ? new Date(updatedSub.discount_end_date).toISOString().split('T')[0] : ''
                                });
                                setShowStoreSubscriptionModal(true);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Manage Subscription
                            </button>
                          </div>
                          {storeSubscriptions[store.id] ? (
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-gray-600">Cost:</span>
                                <span className="font-medium ml-1">${parseFloat(storeSubscriptions[store.id].total_monthly_price || templates.find(t => t.id === store.template_id)?.price_per_month || 0).toFixed(2)}/mo</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Status:</span>
                                <span className={`ml-1 px-1 rounded ${
                                  storeSubscriptions[store.id].status === 'active' ? 'bg-green-100 text-green-800' :
                                  storeSubscriptions[store.id].status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {storeSubscriptions[store.id].status || 'active'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Auto-Renew:</span>
                                <span className={`ml-1 ${storeSubscriptions[store.id].auto_renew !== false ? 'text-green-600' : 'text-gray-400'}`}>
                                  {storeSubscriptions[store.id].auto_renew !== false ? 'Yes' : 'No'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-gray-600">Cost:</span>
                                <span className="font-medium ml-1">${parseFloat(templates.find(t => t.id === store.template_id)?.price_per_month || 0).toFixed(2)}/mo</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Status:</span>
                                <span className="ml-1 px-1 rounded bg-green-100 text-green-800">Active</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Auto-Renew:</span>
                                <span className="ml-1 text-green-600">Yes</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-yellow-800">No subscription assigned</span>
                            <button
                              onClick={() => {
                                setSelectedStoreForSubscription(store);
                                setStoreSubscriptionForm({
                                  template_id: '',
                                  billing_cycle: 'monthly',
                                  auto_renew: true
                                });
                                setDiscountForm({ // Reset discount form when assigning new subscription
                                  discount_percentage: 0,
                                  discount_amount: 0,
                                  discount_applied_to_next_billing: true,
                                  discount_start_date: new Date().toISOString().split('T')[0],
                                  discount_end_date: ''
                                });
                                setShowStoreSubscriptionModal(true);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Assign Subscription
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Store Managers Section */}
                      {storeManagers[store.id] && storeManagers[store.id].length > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-700">Assigned Managers ({storeManagers[store.id].length})</h4>
                          </div>
                          <div className="space-y-2">
                            {storeManagers[store.id].map((managerAssignment) => {
                              const manager = managers.find(m => m.id === managerAssignment.manager_id);
                              if (!manager) return null;
                              
                              return (
                                <div key={managerAssignment.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                      {manager.first_name} {manager.last_name}
                                    </p>
                                    <p className="text-xs text-gray-500">{manager.email}</p>
                                    <div className="flex gap-2 mt-1">
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        managerAssignment.can_edit ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {managerAssignment.can_edit ? 'Can Edit' : 'View Only'}
                                      </span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        managerAssignment.can_view_reports ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {managerAssignment.can_view_reports ? 'Can View Reports' : 'No Reports'}
                                      </span>
                                      {managerAssignment.can_manage_employees && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                                          Can Manage Employees
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingManager({
                                          storeId: store.id,
                                          managerId: managerAssignment.manager_id,
                                          manager: manager,
                                          permissions: {
                                            can_edit: managerAssignment.can_edit,
                                            can_view_reports: managerAssignment.can_view_reports,
                                            can_manage_employees: managerAssignment.can_manage_employees
                                          }
                                        });
                                      }}
                                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleRemoveManager(store.id, managerAssignment.manager_id)}
                                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Link
                        to={`/stores/${store.id}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        View & Edit Data
                      </Link>
                      {store.is_active === true ? (
                        <>
                          <button
                            onClick={() => {
                              // Check if store has manager_access feature
                              const subscription = storeSubscriptions[store.id];
                              const hasManagerAccess = subscription?.addon_feature_keys?.includes('manager_access') || 
                                                       subscription?.features?.some(f => f.feature_key === 'manager_access' && f.is_addon);
                              
                              if (!hasManagerAccess) {
                                alert('Manager Access feature addon is required. Please add "Manager Access" feature addon to this store\'s subscription first. You can do this in the Feature Addons section of Settings.');
                                return;
                              }
                              
                              setSelectedStore(store.id);
                              setShowAssignManagerModal(true);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Assign Manager
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Are you sure you want to deactivate "${store.name}"? It will remain visible but marked as inactive.`)) {
                                try {
                                  const response = await storesAPI.toggleActive(store.id);
                                  alert('Store deactivated successfully!');
                                  // Reload to show updated status
                                  await loadAdminData();
                                } catch (error) {
                                  alert('Error deactivating store: ' + (error.response?.data?.error || error.message));
                                }
                              }
                            }}
                            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                          >
                            Deactivate
                          </button>
                          <button
                            onClick={() => {
                              setStoreToDelete(store);
                              setShowDeleteConfirm(true);
                              setDeleteConfirmText('');
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={async () => {
                              if (confirm(`Reactivate "${store.name}"?`)) {
                                try {
                                  const response = await storesAPI.toggleActive(store.id);
                                  alert('Store activated successfully!');
                                  // Reload to show updated status
                                  await loadAdminData();
                                } catch (error) {
                                  alert('Error activating store: ' + (error.response?.data?.error || error.message));
                                }
                              }
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => {
                              setStoreToDelete(store);
                              setShowDeleteConfirm(true);
                              setDeleteConfirmText('');
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deleted Stores Section */}
      {showDeleted && deletedStores.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6 border-2 border-red-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
            <h2 className="text-lg font-semibold text-red-700">Deleted Stores ({deletedStores.length})</h2>
            <p className="text-sm text-gray-600 mt-1">These stores are hidden from admins and managers but can be restored</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {deletedStores.map((store) => (
                <div key={store.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-700">{store.name}</h3>
                      <p className="text-sm text-gray-600">
                        {store.address}, {store.city}, {store.state} {store.zip_code}
                      </p>
                      <p className="text-sm text-red-600 mt-1">Status: Deleted</p>
                      {store.deleted_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Deleted on: {new Date(store.deleted_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`Restore "${store.name}"? It will become active again.`)) {
                          try {
                            await storesAPI.restore(store.id);
                            alert('Store restored successfully!');
                            loadAdminData();
                          } catch (error) {
                            alert('Error restoring store: ' + (error.response?.data?.error || error.message));
                          }
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Undo / Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                onClick={async () => {
                  if (deleteConfirmText === 'Delete') {
                    try {
                      await storesAPI.delete(storeToDelete.id);
                      alert('Store deleted successfully! You can restore it later.');
                      setShowDeleteConfirm(false);
                      setStoreToDelete(null);
                      setDeleteConfirmText('');
                      loadAdminData();
                    } catch (error) {
                      alert('Error deleting store: ' + (error.response?.data?.error || error.message));
                    }
                  } else {
                    alert('Please type "Delete" exactly to confirm deletion.');
                  }
                }}
                disabled={deleteConfirmText !== 'Delete'}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Store
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Managers Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Managers ({adminManagers.length})</h2>
        </div>
        <div className="p-6">
          {adminManagers.length === 0 ? (
            <p className="text-gray-500">No managers found for this admin</p>
          ) : (
            <div className="space-y-4">
              {adminManagers.map((manager) => (
                <div key={manager.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {manager.first_name} {manager.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">Email: {manager.email}</p>
                      <p className="text-sm text-gray-500">Phone: {manager.phone || 'N/A'}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Password: <span className="font-mono text-xs">••••••••</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        manager.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {manager.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedUserForPassword(manager);
                          setPasswordForm({ newPassword: '', confirmPassword: '' });
                          setShowPasswordModal(true);
                        }}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Change Password
                      </button>
                      <button
                        onClick={() => handleResetPassword(manager.id)}
                        className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create User</h2>
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="admin">Admin (Store Owner)</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                    minLength={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={userForm.first_name}
                      onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={userForm.last_name}
                      onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Manager Modal */}
      {showAssignManagerModal && selectedStore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Assign Manager to Store</h2>
            <form onSubmit={handleAssignManager}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Manager *
                  </label>
                    <select
                    name="manager_id"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Select a manager...</option>
                    {adminManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name} ({manager.email})
                      </option>
                    ))}
                  </select>
                </div>
                {adminManagers.length === 0 && (
                  <p className="text-sm text-yellow-600">
                    No managers available. Please create a manager first.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignManagerModal(false);
                    setSelectedStore(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminManagers.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Assign Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Manager Permissions Modal */}
      {editingManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              Edit Manager Permissions - {editingManager.manager.first_name} {editingManager.manager.last_name}
            </h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              handleUpdateManagerPermissions(
                editingManager.storeId,
                editingManager.managerId,
                {
                  can_edit: formData.get('can_edit') === 'on',
                  can_view_reports: formData.get('can_view_reports') === 'on',
                  can_manage_employees: formData.get('can_manage_employees') === 'on'
                }
              );
            }}>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="can_edit"
                    name="can_edit"
                    defaultChecked={editingManager.permissions.can_edit}
                    className="mr-2"
                  />
                  <label htmlFor="can_edit" className="text-sm font-medium text-gray-700">
                    Can Edit Store Data
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="can_view_reports"
                    name="can_view_reports"
                    defaultChecked={editingManager.permissions.can_view_reports}
                    className="mr-2"
                  />
                  <label htmlFor="can_view_reports" className="text-sm font-medium text-gray-700">
                    Can View Reports
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="can_manage_employees"
                    name="can_manage_employees"
                    defaultChecked={editingManager.permissions.can_manage_employees}
                    className="mr-2"
                  />
                  <label htmlFor="can_manage_employees" className="text-sm font-medium text-gray-700">
                    Can Manage Employees
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingManager(null)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Update Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Store Modal */}
      {showCreateStoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Store for {adminUser.first_name} {adminUser.last_name}</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await storesAPI.create({
                  ...storeForm,
                  admin_id: userId,
                  created_by: userId
                });
                alert('Store created successfully!');
                setShowCreateStoreModal(false);
                setStoreForm({
                  name: '',
                  store_type: 'galaxy',
                  address: '',
                  city: '',
                  state: '',
                  zip_code: '',
                  phone: ''
                });
                loadAdminData();
              } catch (error) {
                alert('Error creating store: ' + (error.response?.data?.error || error.message));
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    value={storeForm.name}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Type *
                  </label>
                  <select
                    value={storeForm.store_type}
                    onChange={(e) => setStoreForm({ ...storeForm, store_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="galaxy">Galaxy</option>
                    <option value="newsstand">Newsstand</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={storeForm.address}
                    onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={storeForm.city}
                      onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={storeForm.state}
                      onChange={(e) => setStoreForm({ ...storeForm, state: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zip Code
                    </label>
                    <input
                      type="text"
                      value={storeForm.zip_code}
                      onChange={(e) => setStoreForm({ ...storeForm, zip_code: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={storeForm.phone}
                      onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateStoreModal(false);
                    setStoreForm({
                      name: '',
                      store_type: 'galaxy',
                      address: '',
                      city: '',
                      state: '',
                      zip_code: '',
                      phone: ''
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Store to New Manager Modal */}
      {showAssignStoreModal && newlyCreatedManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Assign Store to Manager</h2>
            <p className="text-sm text-gray-600 mb-4">
              Manager <strong>{newlyCreatedManager.first_name} {newlyCreatedManager.last_name}</strong> has been created. 
              Please assign them to a store.
            </p>
            <form onSubmit={handleAssignStoreToNewManager}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Store *
                  </label>
                  <select
                    name="store_id"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Select a store...</option>
                    {stores.filter(s => s.is_active !== false && !s.deleted_at).map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
                {stores.filter(s => s.is_active !== false && !s.deleted_at).length === 0 && (
                  <p className="text-sm text-yellow-600">
                    No active stores available. Please create a store first.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignStoreModal(false);
                    setNewlyCreatedManager(null);
                    loadAdminData();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  disabled={stores.filter(s => s.is_active !== false && !s.deleted_at).length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Assign Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && selectedUserForPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            <p className="text-sm text-gray-600 mb-4">
              Changing password for: <strong>{selectedUserForPassword.first_name} {selectedUserForPassword.last_name}</strong> ({selectedUserForPassword.email})
            </p>
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setSelectedUserForPassword(null);
                    setPasswordForm({ newPassword: '', confirmPassword: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store Subscription Management Modal */}
      {showStoreSubscriptionModal && selectedStoreForSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              Manage Subscription - {selectedStoreForSubscription.name}
            </h2>
            
            <div className="space-y-6">
              {/* Current Subscription Info */}
              {storeSubscriptions[selectedStoreForSubscription.id] && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Current Subscription</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Plan:</span>
                      <span className="ml-2 font-medium">{storeSubscriptions[selectedStoreForSubscription.id].template_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Billing Cycle:</span>
                      <span className="ml-2 font-medium capitalize">{storeSubscriptions[selectedStoreForSubscription.id].billing_cycle || 'monthly'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Monthly Cost:</span>
                      <span className="ml-2 font-medium">${parseFloat(storeSubscriptions[selectedStoreForSubscription.id].total_monthly_price || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        storeSubscriptions[selectedStoreForSubscription.id].status === 'active' ? 'bg-green-100 text-green-800' :
                        storeSubscriptions[selectedStoreForSubscription.id].status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {storeSubscriptions[selectedStoreForSubscription.id].status || 'active'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Next Billing:</span>
                      <span className="ml-2 font-medium">
                        {storeSubscriptions[selectedStoreForSubscription.id].next_billing_date 
                          ? new Date(storeSubscriptions[selectedStoreForSubscription.id].next_billing_date).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Auto-Renew:</span>
                      <span className={`ml-2 ${storeSubscriptions[selectedStoreForSubscription.id].auto_renew ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                        {storeSubscriptions[selectedStoreForSubscription.id].auto_renew ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {(storeSubscriptions[selectedStoreForSubscription.id].discount_percentage > 0 || storeSubscriptions[selectedStoreForSubscription.id].discount_amount > 0) && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Current Discount:</span>
                        <span className="ml-2 text-green-600 font-medium">
                          {storeSubscriptions[selectedStoreForSubscription.id].discount_percentage > 0 && `${storeSubscriptions[selectedStoreForSubscription.id].discount_percentage}%`}
                          {storeSubscriptions[selectedStoreForSubscription.id].discount_percentage > 0 && storeSubscriptions[selectedStoreForSubscription.id].discount_amount > 0 && ' + '}
                          {storeSubscriptions[selectedStoreForSubscription.id].discount_amount > 0 && `$${parseFloat(storeSubscriptions[selectedStoreForSubscription.id].discount_amount).toFixed(2)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Subscription Plan Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Plan *
                </label>
                <select
                  value={storeSubscriptionForm.template_id}
                  onChange={(e) => setStoreSubscriptionForm({ ...storeSubscriptionForm, template_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="">Select a subscription plan...</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} - ${parseFloat(template.price_per_month || 0).toFixed(2)}/{template.billing_cycle}
                    </option>
                  ))}
                </select>
                {storeSubscriptionForm.template_id && templates.find(t => t.id === storeSubscriptionForm.template_id) && (
                  <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                    <p className="font-medium">Plan Details:</p>
                    <p className="text-gray-600">
                      {templates.find(t => t.id === storeSubscriptionForm.template_id)?.description || 'No description'}
                    </p>
                    <p className="text-gray-600 mt-1">
                      Features: {templates.find(t => t.id === storeSubscriptionForm.template_id)?.feature_keys?.length || 0} included
                    </p>
                  </div>
                )}
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Cycle *
                </label>
                <select
                  value={storeSubscriptionForm.billing_cycle}
                  onChange={(e) => setStoreSubscriptionForm({ ...storeSubscriptionForm, billing_cycle: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {/* Auto-Renew */}
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded">
                <input
                  type="checkbox"
                  id="auto-renew"
                  checked={storeSubscriptionForm.auto_renew}
                  onChange={(e) => setStoreSubscriptionForm({ ...storeSubscriptionForm, auto_renew: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="auto-renew" className="text-sm text-gray-700 cursor-pointer">
                  <strong>Auto-Renew Subscription</strong>
                  <p className="text-xs text-gray-600 mt-1">
                    Automatically renew this subscription on the billing date. The store will be billed automatically.
                  </p>
                </label>
              </div>

              {/* Status Control */}
              {storeSubscriptions[selectedStoreForSubscription.id] && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subscription Status
                  </label>
                  <select
                    value={storeSubscriptions[selectedStoreForSubscription.id].status || 'active'}
                    onChange={async (e) => {
                      try {
                        await storeSubscriptionsAPI.updateStatus(selectedStoreForSubscription.id, e.target.value);
                        alert('Subscription status updated successfully!');
                        loadAdminData();
                      } catch (error) {
                        alert('Error updating status: ' + (error.response?.data?.error || error.message));
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              {/* Discount Section */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Discount Management</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount Percentage (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={discountForm.discount_percentage}
                        onChange={(e) => setDiscountForm({ ...discountForm, discount_percentage: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount Amount ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountForm.discount_amount}
                        onChange={(e) => setDiscountForm({ ...discountForm, discount_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount Start Date
                      </label>
                      <input
                        type="date"
                        value={discountForm.discount_start_date}
                        onChange={(e) => setDiscountForm({ ...discountForm, discount_start_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount End Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={discountForm.discount_end_date || ''}
                        onChange={(e) => setDiscountForm({ ...discountForm, discount_end_date: e.target.value || '' })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="apply-to-next-billing"
                      checked={discountForm.discount_applied_to_next_billing}
                      onChange={(e) => setDiscountForm({ ...discountForm, discount_applied_to_next_billing: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="apply-to-next-billing" className="text-sm text-gray-700">
                      Apply discount to next billing cycle
                    </label>
                  </div>
                  {(discountForm.discount_percentage > 0 || discountForm.discount_amount > 0) && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await storeSubscriptionsAPI.updateDiscount(selectedStoreForSubscription.id, {
                            discount_percentage: discountForm.discount_percentage,
                            discount_amount: discountForm.discount_amount,
                            discount_applied_to_next_billing: discountForm.discount_applied_to_next_billing,
                            discount_start_date: discountForm.discount_start_date,
                            discount_end_date: discountForm.discount_end_date || null
                          });
                          alert('Discount applied successfully!');
                          loadAdminData();
                        } catch (error) {
                          alert('Error applying discount: ' + (error.response?.data?.error || error.message));
                        }
                      }}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Apply Discount
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowStoreSubscriptionModal(false);
                  setSelectedStoreForSubscription(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!storeSubscriptionForm.template_id) {
                    alert('Please select a subscription plan');
                    return;
                  }
                  try {
                    // Create or update subscription directly
                    const response = await storeSubscriptionsAPI.create(selectedStoreForSubscription.id, {
                      template_id: storeSubscriptionForm.template_id,
                      billing_cycle: storeSubscriptionForm.billing_cycle,
                      auto_renew: storeSubscriptionForm.auto_renew,
                      start_date: new Date().toISOString().split('T')[0]
                    });
                    console.log('Subscription created/updated:', response.data);
                    alert('Subscription assigned/updated successfully!');
                    setShowStoreSubscriptionModal(false);
                    setSelectedStoreForSubscription(null);
                    // Reload data after a short delay to ensure DB is updated
                    setTimeout(() => {
                      loadAdminData();
                    }, 1000);
                  } catch (error) {
                    console.error('Error assigning subscription:', error);
                    console.error('Error response:', error.response);
                    alert('Error assigning subscription: ' + (error.response?.data?.error || error.response?.data?.details || error.message || error.toString()));
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {storeSubscriptions[selectedStoreForSubscription.id] ? 'Update Subscription' : 'Assign Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDetail;

