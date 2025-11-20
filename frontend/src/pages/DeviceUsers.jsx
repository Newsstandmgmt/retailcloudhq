import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';

const DeviceUsers = ({ embedded = false }) => {
  const { user } = useAuth();
  const { selectedStore } = useStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee',
    phone: '',
    employee_pin: '',
  });

  useEffect(() => {
    if (selectedStore && (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'manager')) {
      loadUsers();
    }
  }, [selectedStore, user]);

  const loadUsers = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await usersAPI.getDeviceUsers(selectedStore.id);
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error loading device users:', error);
      alert('Error loading device users: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedStore) return;
    
    try {
      await usersAPI.createDeviceUser(selectedStore.id, formData);
      alert('User created successfully!');
      setShowCreateModal(false);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'employee',
        phone: '',
        employee_pin: '',
      });
      loadUsers();
    } catch (error) {
      alert('Error creating user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (userToEdit) => {
    setEditingUser(userToEdit);
    setFormData({
      email: userToEdit.email,
      password: '', // Don't pre-fill password
      first_name: userToEdit.first_name,
      last_name: userToEdit.last_name,
      role: userToEdit.role,
      phone: userToEdit.phone || '',
      employee_pin: '', // Don't show existing PIN
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
      };
      
      // Only update password if provided
      if (formData.password) {
        updateData.password = formData.password;
      }
      
      await usersAPI.update(editingUser.id, updateData);
      
      // Update PIN if provided and user is employee
      if (formData.employee_pin && editingUser.role === 'employee') {
        await usersAPI.updateDeviceUserPin(editingUser.id, formData.employee_pin);
      } else if (formData.employee_pin === '' && editingUser.role === 'employee') {
        await usersAPI.updateDeviceUserPin(editingUser.id, '');
      }
      
      alert('User updated successfully!');
      setShowEditModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      alert('Error updating user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) return;
    
    try {
      await usersAPI.deleteDeviceUser(userId);
      alert('User deleted successfully!');
      loadUsers();
    } catch (error) {
      alert('Error deleting user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdatePin = async (userId, newPin) => {
    if (!newPin || !/^\d{4,6}$/.test(newPin)) {
      alert('PIN must be a 4-6 digit number');
      return;
    }
    
    try {
      await usersAPI.updateDeviceUserPin(userId, newPin);
      alert('PIN updated successfully!');
      loadUsers();
    } catch (error) {
      alert('Error updating PIN: ' + (error.response?.data?.error || error.message));
    }
  };

  const filteredUsers = users.filter(u => {
    const searchLower = searchTerm.toLowerCase();
    return (
      u.first_name?.toLowerCase().includes(searchLower) ||
      u.last_name?.toLowerCase().includes(searchLower) ||
      u.email?.toLowerCase().includes(searchLower) ||
      u.role?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const canCreateManager = user?.role === 'super_admin' || user?.role === 'admin';
  const canDeleteManager = user?.role === 'super_admin' || user?.role === 'admin';
  const canDeleteEmployee = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'manager';

  if (!selectedStore) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Please select a store to manage device users.</p>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'p-6'}>
      {!embedded && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DEVICE USERS</h1>
            <p className="text-sm text-gray-600 mt-1">{selectedStore.name}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Back
          </button>
        </div>
      )}

      {embedded && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Device Users</h3>
          <p className="text-sm text-gray-600">Manage employees and managers for handheld device access</p>
        </div>
      )}

      {/* Search and Actions */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setSearchTerm('')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Clear
          </button>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add New User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Group</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email Address</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website Password</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Handheld PIN</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Display Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delete</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => (
                <tr key={u.id} className={u.is_active === false ? 'bg-gray-50 opacity-75' : ''}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(u)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ✏️
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {u.role === 'super_admin' ? 'Super Admin' :
                     u.role === 'admin' ? 'Admin' :
                     u.role === 'manager' ? 'Manager' : 'Employee'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{u.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {u.password_hash ? '••••••••' : ''}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {u.has_employee_pin ? (
                      <span className="text-green-600">✓ Set</span>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(u.id !== user?.id) && (
                      (u.role === 'manager' && canDeleteManager) ||
                      (u.role === 'employee' && canDeleteEmployee) ||
                      (u.role === 'admin' && user?.role === 'super_admin')
                    ) ? (
                      <button
                        onClick={() => handleDelete(u.id, `${u.first_name} ${u.last_name}`)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ◄◄
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ◀
          </button>
          <span className="px-4">
            {currentPage} / {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ▶
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ►►
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="ml-4 px-2 py-1 border rounded"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="text-sm text-gray-600">
          {filteredUsers.length} items in {totalPages || 1} pages
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add New User</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {canCreateManager && <option value="manager">Manager</option>}
                  <option value="employee">Employee</option>
                </select>
              </div>
              {formData.role === 'employee' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Handheld PIN (4-6 digits)</label>
                  <input
                    type="text"
                    pattern="\d{4,6}"
                    value={formData.employee_pin}
                    onChange={(e) => setFormData({ ...formData, employee_pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      email: '',
                      password: '',
                      first_name: '',
                      last_name: '',
                      role: 'employee',
                      phone: '',
                      employee_pin: '',
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Edit User</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave blank to keep current password"
                />
              </div>
              {editingUser.role === 'employee' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Handheld PIN (4-6 digits, leave blank to clear)</label>
                  <input
                    type="text"
                    pattern="\d{4,6}"
                    value={formData.employee_pin}
                    onChange={(e) => setFormData({ ...formData, employee_pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={editingUser.has_employee_pin ? 'Enter new PIN or leave blank to clear' : 'Enter PIN'}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceUsers;

