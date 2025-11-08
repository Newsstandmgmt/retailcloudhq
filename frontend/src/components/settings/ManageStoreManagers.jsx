import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { storeManagersAPI, usersAPI, storeSubscriptionsAPI, storesAPI } from '../../services/api';
import api from '../../services/api';

const ManageStoreManagers = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [managers, setManagers] = useState([]); // Managers assigned to current store
  const [allManagers, setAllManagers] = useState([]); // All managers created by admin (or all for super_admin)
  const [managerStoreAssignments, setManagerStoreAssignments] = useState({}); // { managerId: [{store_id, store_name, ...}] }
  const [allStores, setAllStores] = useState([]); // All stores for admin/super_admin
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateManagerModal, setShowCreateManagerModal] = useState(false);
  const [formData, setFormData] = useState({
    manager_id: '',
    can_edit: true,
    can_view_reports: true,
    can_manage_employees: false
  });
  const [createManagerForm, setCreateManagerForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: ''
  });

  useEffect(() => {
    if (selectedStore) {
      loadSubscription();
    }
  }, [selectedStore]);

  // Load managers after subscription is loaded
  useEffect(() => {
    if (selectedStore) {
      loadManagers();
    }
  }, [selectedStore, subscription]);

  // Load all managers and their store assignments after managers for current store are loaded
  useEffect(() => {
    if (selectedStore) {
      loadAllStores();
      loadAllManagers();
    }
  }, [selectedStore, managers]);

  const loadSubscription = async () => {
    if (!selectedStore) return;
    try {
      const response = await storeSubscriptionsAPI.getByStore(selectedStore.id);
      setSubscription(response.data.subscription || null);
    } catch (error) {
      console.error('Error loading subscription:', error);
      setSubscription(null);
    }
  };

  const loadAllStores = async () => {
    try {
      const response = await storesAPI.getAll();
      setAllStores(response.data.stores || []);
    } catch (error) {
      console.error('Error loading stores:', error);
      setAllStores([]);
    }
  };

  const loadManagers = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await storeManagersAPI.getByStore(selectedStore.id);
      setManagers(response.data.managers || []);
    } catch (error) {
      console.error('Error loading managers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllManagers = async () => {
    if (!selectedStore) return;
    try {
      // Get users with manager role
      const response = await api.get('/api/users');
      const allUsers = response.data.users || [];
      
      // Filter managers created by this admin (if admin) or all managers (if super_admin)
      let filteredManagers = allUsers.filter(u => u.role === 'manager');
      if (user?.role === 'admin') {
        // Only show managers created by this admin
        filteredManagers = filteredManagers.filter(m => m.created_by === user.id);
      }
      
      setAllManagers(filteredManagers);
      
      // Get store assignments for each manager
      const assignmentsMap = {};
      for (const manager of filteredManagers) {
        try {
          // Get all stores this manager is assigned to using the new endpoint
          const storesRes = await storeManagersAPI.getByManager(manager.id);
          const assignedStores = storesRes.data.stores || [];
          assignmentsMap[manager.id] = assignedStores; // Store full store objects with store_id, store_name, etc.
        } catch (error) {
          console.error(`Error loading stores for manager ${manager.id}:`, error);
          assignmentsMap[manager.id] = [];
        }
      }
      setManagerStoreAssignments(assignmentsMap);
    } catch (error) {
      console.error('Error loading all managers:', error);
      setAllManagers([]);
      setManagerStoreAssignments({});
    }
  };

  const handleAddManager = async (e) => {
    e.preventDefault();
    if (!selectedStore || !formData.manager_id) return;

    // Check if store has manager_access feature addon
    const hasManagerAccess = subscription?.addon_feature_keys?.includes('manager_access') || 
                             subscription?.features?.some(f => f.feature_key === 'manager_access' && f.is_addon);
    
    if (!hasManagerAccess) {
      alert('Manager Access feature addon is required. Please add "Manager Access" feature addon to this store\'s subscription first. You can do this in the "Feature Addons" tab above.');
      setShowAddModal(false);
      return;
    }

    try {
      await storeManagersAPI.assign(selectedStore.id, formData.manager_id, {
        can_edit: formData.can_edit,
        can_view_reports: formData.can_view_reports,
        can_manage_employees: formData.can_manage_employees
      });
      setShowAddModal(false);
      setFormData({
        manager_id: '',
        can_edit: true,
        can_view_reports: true,
        can_manage_employees: false
      });
      loadManagers();
      loadAllManagers();
    } catch (error) {
      alert('Error adding manager: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRemoveManager = async (managerId) => {
    if (!window.confirm('Are you sure you want to remove this manager from the store?')) {
      return;
    }

    try {
      await storeManagersAPI.remove(selectedStore.id, managerId);
      loadManagers();
      loadAllManagers();
    } catch (error) {
      alert('Error removing manager: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdatePermissions = async (managerId, permissions) => {
    try {
      await storeManagersAPI.assign(selectedStore.id, managerId, permissions);
      loadManagers();
    } catch (error) {
      alert('Error updating permissions: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
    
    // Check if store has manager_access feature addon
    const hasManagerAccess = subscription?.addon_feature_keys?.includes('manager_access') || 
                             subscription?.features?.some(f => f.feature_key === 'manager_access' && f.is_addon);
    
    if (!hasManagerAccess) {
      alert('Manager Access feature addon is required to create managers. Please add "Manager Access" feature addon to this store\'s subscription first. You can do this in the "Feature Addons" tab above.');
      setShowCreateManagerModal(false);
      return;
    }

    try {
      const response = await usersAPI.create({
        ...createManagerForm,
        role: 'manager',
        created_by: user?.id // Track who created this manager
      });
      
      alert('Manager created successfully! They will be prompted to change their password on first login.');
      setShowCreateManagerModal(false);
      setCreateManagerForm({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone: ''
      });
      // Reload available users to show the newly created manager
      await loadAllManagers();
    } catch (error) {
      alert('Error creating manager: ' + (error.response?.data?.error || error.message));
    }
  };

  if (!selectedStore) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Check if store has manager_access feature addon
  const hasManagerAccess = subscription?.addon_feature_keys?.includes('manager_access') || 
                           subscription?.features?.some(f => f.feature_key === 'manager_access' && f.is_addon);

  return (
    <div className="p-6 w-full min-w-0">
      {/* Warning if manager_access feature is not enabled */}
      {!hasManagerAccess && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">Manager Access Feature Required</h3>
              <p className="text-sm text-yellow-700 mt-1">
                To assign managers to this store, you need to add the "Manager Access" feature addon to your subscription. 
                Go to the <strong>"Feature Addons"</strong> tab above to add it.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage User</h2>
        <div className="flex gap-2">
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <button
              onClick={() => {
                // Check if store has manager_access feature
                if (!hasManagerAccess) {
                  alert('Manager Access feature addon is required to create managers. Please add "Manager Access" feature addon to this store\'s subscription first. You can do this in the "Feature Addons" tab above.');
                  return;
                }
                setShowCreateManagerModal(true);
              }}
              disabled={!hasManagerAccess}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                hasManagerAccess 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Create Manager
            </button>
          )}
          <button
            onClick={() => {
              // Check if store has manager_access feature
              if (!hasManagerAccess) {
                alert('Manager Access feature addon is required. Please add "Manager Access" feature addon to this store\'s subscription first. You can do this in the "Feature Addons" tab above.');
                return;
              }
              setShowAddModal(true);
            }}
            disabled={!hasManagerAccess}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              hasManagerAccess 
                ? 'bg-[#2d8659] text-white hover:bg-[#256b49]' 
                : 'bg-gray-400 text-white cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Assign Manager
          </button>
        </div>
      </div>

      {/* Assigned Managers Section */}
      {hasManagerAccess && managers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Managers ({managers.length})</h3>
          <div className="space-y-4 w-full">
            {managers.map((manager) => (
              <div key={manager.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {manager.first_name} {manager.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">{manager.email}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveManager(manager.manager_id)}
                    className="text-red-600 hover:text-red-800"
                    title="Remove Manager"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Can Edit</label>
                    <button
                      onClick={() => handleUpdatePermissions(manager.manager_id, {
                        can_edit: !manager.can_edit,
                        can_view_reports: manager.can_view_reports,
                        can_manage_employees: manager.can_manage_employees
                      })}
                      className={`px-4 py-2 rounded text-sm font-medium ${
                        manager.can_edit
                          ? 'bg-[#2d8659] text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {manager.can_edit ? 'Yes' : 'No'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Can View Reports</label>
                    <button
                      onClick={() => handleUpdatePermissions(manager.manager_id, {
                        can_edit: manager.can_edit,
                        can_view_reports: !manager.can_view_reports,
                        can_manage_employees: manager.can_manage_employees
                      })}
                      className={`px-4 py-2 rounded text-sm font-medium ${
                        manager.can_view_reports
                          ? 'bg-[#2d8659] text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {manager.can_view_reports ? 'Yes' : 'No'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Can Manage Employees</label>
                    <button
                      onClick={() => handleUpdatePermissions(manager.manager_id, {
                        can_edit: manager.can_edit,
                        can_view_reports: manager.can_view_reports,
                        can_manage_employees: !manager.can_manage_employees
                      })}
                      className={`px-4 py-2 rounded text-sm font-medium ${
                        manager.can_manage_employees
                          ? 'bg-[#2d8659] text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {manager.can_manage_employees ? 'Yes' : 'No'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Managers Section - Show all managers with their store assignments */}
      {hasManagerAccess && allManagers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            All Managers ({allManagers.length})
            {user?.role === 'admin' && <span className="text-sm font-normal text-gray-600 ml-2">(Managers you created)</span>}
          </h3>
          <div className="space-y-4 w-full">
            {allManagers.map((manager) => {
              const assignedStores = managerStoreAssignments[manager.id] || [];
              const isAssignedToCurrentStore = assignedStores.some(s => s.store_id === selectedStore.id);
              
              return (
                <div key={manager.id} className={`border rounded-lg p-6 shadow-sm ${
                  isAssignedToCurrentStore ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {manager.first_name} {manager.last_name}
                        </h3>
                        {isAssignedToCurrentStore && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Assigned to this store
                          </span>
                        )}
                        {user?.role === 'super_admin' && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {manager.created_by ? 'Admin Created' : 'System'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{manager.email}</p>
                      
                      {/* Show assigned stores */}
                      {assignedStores.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-700 mb-1">Assigned to stores ({assignedStores.length}):</p>
                          <div className="flex flex-wrap gap-2">
                            {assignedStores.map((storeAssignment) => {
                              const store = allStores.find(s => s.id === storeAssignment.store_id);
                              return (
                                <span
                                  key={storeAssignment.store_id}
                                  className={`px-2 py-1 text-xs rounded ${
                                    storeAssignment.store_id === selectedStore.id
                                      ? 'bg-green-100 text-green-800 border border-green-300'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {store?.name || storeAssignment.store_name || 'Unknown Store'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {assignedStores.length === 0 && (
                        <p className="text-xs text-gray-500 mt-2">Not assigned to any store</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {!isAssignedToCurrentStore && (
                        <button
                          onClick={() => {
                            setFormData({
                              manager_id: manager.id,
                              can_edit: true,
                              can_view_reports: true,
                              can_manage_employees: false
                            });
                            setShowAddModal(true);
                          }}
                          className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49] text-sm font-medium"
                        >
                          Assign to This Store
                        </button>
                      )}
                      {isAssignedToCurrentStore && (
                        <button
                          onClick={() => handleRemoveManager(manager.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                        >
                          Remove from This Store
                        </button>
                      )}
                      {user?.role === 'super_admin' && (
                        <button
                          onClick={() => {
                            // Enhanced controls for super admin - could open edit modal
                            alert('Enhanced manager controls coming soon!');
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                        >
                          Manage
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {hasManagerAccess && !loading && allManagers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No managers found. Click "Create Manager" to create a new manager.</p>
        </div>
      )}

      {/* Add Manager Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Manager</h2>
            <form onSubmit={handleAddManager}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Manager *
                  </label>
                  <select
                    value={formData.manager_id}
                    onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  >
                    <option value="">Select Manager</option>
                    {allManagers
                      .filter(manager => {
                        const assignedStores = managerStoreAssignments[manager.id] || [];
                        return !assignedStores.some(s => s.store_id === selectedStore.id);
                      })
                      .map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.first_name} {manager.last_name} ({manager.email})
                        </option>
                      ))}
                  </select>
                  {allManagers.filter(manager => {
                    const assignedStores = managerStoreAssignments[manager.id] || [];
                    return !assignedStores.some(s => s.store_id === selectedStore.id);
                  }).length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">All managers are already assigned to this store.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Can Edit</label>
                    <input
                      type="checkbox"
                      checked={formData.can_edit}
                      onChange={(e) => setFormData({ ...formData, can_edit: e.target.checked })}
                      className="w-4 h-4 text-[#2d8659] border-gray-300 rounded focus:ring-[#2d8659]"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Can View Reports</label>
                    <input
                      type="checkbox"
                      checked={formData.can_view_reports}
                      onChange={(e) => setFormData({ ...formData, can_view_reports: e.target.checked })}
                      className="w-4 h-4 text-[#2d8659] border-gray-300 rounded focus:ring-[#2d8659]"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Can Manage Employees</label>
                    <input
                      type="checkbox"
                      checked={formData.can_manage_employees}
                      onChange={(e) => setFormData({ ...formData, can_manage_employees: e.target.checked })}
                      className="w-4 h-4 text-[#2d8659] border-gray-300 rounded focus:ring-[#2d8659]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  Add Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Manager Modal */}
      {showCreateManagerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Manager</h2>
            <form onSubmit={handleCreateManager}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={createManagerForm.first_name}
                    onChange={(e) => setCreateManagerForm({ ...createManagerForm, first_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={createManagerForm.last_name}
                    onChange={(e) => setCreateManagerForm({ ...createManagerForm, last_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={createManagerForm.email}
                    onChange={(e) => setCreateManagerForm({ ...createManagerForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={createManagerForm.phone}
                    onChange={(e) => setCreateManagerForm({ ...createManagerForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temporary Password *
                  </label>
                  <input
                    type="password"
                    value={createManagerForm.password}
                    onChange={(e) => setCreateManagerForm({ ...createManagerForm, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Manager will be prompted to change this password on first login
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateManagerModal(false);
                    setCreateManagerForm({
                      email: '',
                      password: '',
                      first_name: '',
                      last_name: '',
                      phone: ''
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  Create Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStoreManagers;

