import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminManagementAPI, usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AdminManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState('admins'); // 'admins' or 'all'
  const [configData, setConfigData] = useState({
    max_stores: null,
    features: {
      can_create_stores: true,
      can_manage_users: true,
      can_view_reports: true,
    },
    assigned_stores: [],
    master_pin: ''
  });
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    max_stores: null
  });

  useEffect(() => {
    if (user?.role === 'super_admin') {
      if (viewMode === 'admins') {
        loadAdmins();
      } else {
        loadAllUsers();
      }
    }
  }, [user, showInactive, viewMode]);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const response = await adminManagementAPI.getAdmins(showInactive);
      setAdmins(response.data.admins || []);
    } catch (error) {
      console.error('Error loading admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const response = await adminManagementAPI.getUsersByRole('all', showInactive);
      setAllUsers(response.data.users || []);
    } catch (error) {
      console.error('Error loading all users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      // First create the user
      const userResponse = await usersAPI.create({
        ...adminForm,
        role: 'admin'
      });
      
      // Then create admin config
      if (adminForm.max_stores) {
        await adminManagementAPI.updateAdminConfig(userResponse.data.user.id, {
          max_stores: adminForm.max_stores ? parseInt(adminForm.max_stores) : null,
          features: {
            can_create_stores: true,
            can_manage_users: true,
            can_view_reports: true
          },
          assigned_stores: []
        });
      }
      
      alert('Admin created successfully!');
      setShowCreateAdminModal(false);
      setAdminForm({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone: '',
        max_stores: null
      });
      loadAdmins();
    } catch (error) {
      alert('Error creating admin: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditConfig = async (admin) => {
    try {
      const response = await adminManagementAPI.getAdminConfig(admin.user_id);
      if (response.data.config) {
        setConfigData({
          max_stores: response.data.config.max_stores,
          features: response.data.config.features || configData.features,
          assigned_stores: response.data.config.assigned_stores || [],
          master_pin: '' // Never show existing PIN for security
        });
      }
      setSelectedAdmin(admin);
      setShowConfigModal(true);
    } catch (error) {
      // If config doesn't exist, create new one
      setSelectedAdmin(admin);
      setShowConfigModal(true);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await adminManagementAPI.updateAdminConfig(selectedAdmin.user_id, configData);
      alert('Admin configuration saved successfully!');
      setShowConfigModal(false);
      loadAdmins();
    } catch (error) {
      alert('Error saving config: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
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
          <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
          <p className="text-gray-600 mt-1">Manage store owners (admins) and their permissions</p>
        </div>
        <button
          onClick={() => setShowCreateAdminModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create Admin
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('admins')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'admins'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Admins Only
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'all'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Users
          </button>
        </div>
      </div>

      {/* Admins/Users List */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{viewMode === 'admins' ? 'Admins' : 'All Users'}</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show Inactive Users</span>
          </label>
        </div>
        <div className="p-6">
          {viewMode === 'admins' ? (
            admins.length === 0 ? (
              <p className="text-gray-500">No admins found</p>
            ) : (
              <div className="space-y-4">
                {admins.map((admin) => (
                <div key={admin.id} className={`border rounded-lg p-4 ${admin.is_active === false ? 'border-gray-300 bg-gray-50 opacity-75' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {admin.first_name} {admin.last_name}
                        </h3>
                        {admin.is_active === false && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{admin.email}</p>
                      <div className="mt-2 flex gap-4 text-sm">
                        <span>
                          <strong>Max Stores:</strong>{' '}
                          {admin.max_stores === null ? 'Unlimited' : admin.max_stores}
                        </span>
                        <span>
                          <strong>Features:</strong>{' '}
                          {admin.features ? Object.keys(admin.features).filter(k => admin.features[k]).join(', ') : 'None'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const adminId = admin.user_id || admin.id;
                          if (!adminId) {
                            alert('Error: Admin ID is missing. Cannot navigate to admin details.');
                            return;
                          }
                          navigate(`/admin-management/${adminId}`);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        View Stores & Data
                      </button>
                      <button
                        onClick={() => handleEditConfig(admin)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Configure
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )
          ) : (
            allUsers.length === 0 ? (
              <p className="text-gray-500">No users found</p>
            ) : (
              <div className="space-y-4">
                {allUsers.map((user) => (
                  <div key={user.id} className={`border rounded-lg p-4 ${user.is_active === false ? 'border-gray-300 bg-gray-50 opacity-75' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {user.first_name} {user.last_name}
                          </h3>
                          {user.is_active === false && (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                              Inactive
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                            user.role === 'manager' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {user.role === 'admin' && (
                          <>
                            <button
                              onClick={() => {
                                const adminId = user.id;
                                if (!adminId) {
                                  alert('Error: User ID is missing. Cannot navigate to admin details.');
                                  return;
                                }
                                navigate(`/admin-management/${adminId}`);
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              View Stores & Data
                            </button>
                            <button
                              onClick={() => {
                                const admin = { ...user, user_id: user.id };
                                handleEditConfig(admin);
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Configure
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Config Modal */}
      {showConfigModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              Configure: {selectedAdmin.first_name} {selectedAdmin.last_name}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Stores (leave empty for unlimited)
                </label>
                <input
                  type="number"
                  value={configData.max_stores || ''}
                  onChange={(e) => setConfigData({
                    ...configData,
                    max_stores: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Unlimited"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Master PIN (for mobile device login)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={configData.master_pin}
                  onChange={(e) => {
                    // Only allow digits
                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setConfigData({ ...configData, master_pin: value });
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter 4-6 digit PIN (leave empty to keep existing)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Master PIN allows this admin/manager to login on any registered device. Leave empty to keep existing PIN unchanged.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Features
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={configData.features.can_create_stores}
                      onChange={(e) => setConfigData({
                        ...configData,
                        features: {
                          ...configData.features,
                          can_create_stores: e.target.checked
                        }
                      })}
                      className="mr-2"
                    />
                    Can Create Stores
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={configData.features.can_manage_users}
                      onChange={(e) => setConfigData({
                        ...configData,
                        features: {
                          ...configData.features,
                          can_manage_users: e.target.checked
                        }
                      })}
                      className="mr-2"
                    />
                    Can Manage Users
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={configData.features.can_view_reports}
                      onChange={(e) => setConfigData({
                        ...configData,
                        features: {
                          ...configData.features,
                          can_view_reports: e.target.checked
                        }
                      })}
                      className="mr-2"
                    />
                    Can View Reports
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create Admin (Store Owner)</h2>
            <form onSubmit={handleCreateAdmin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
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
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
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
                      value={adminForm.first_name}
                      onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })}
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
                      value={adminForm.last_name}
                      onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })}
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
                    value={adminForm.phone}
                    onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Stores (leave empty for unlimited)
                  </label>
                  <input
                    type="number"
                    value={adminForm.max_stores || ''}
                    onChange={(e) => setAdminForm({
                      ...adminForm,
                      max_stores: e.target.value ? parseInt(e.target.value) : null
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateAdminModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;

