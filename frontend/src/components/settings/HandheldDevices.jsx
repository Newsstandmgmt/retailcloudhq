import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { mobileDevicesAPI } from '../../services/api';

const HandheldDevices = ({
  storeIdOverride = null,
  storeNameOverride = null,
  embedded = false,
}) => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageAssignments = user?.role === 'admin' || isSuperAdmin;
  const activeStoreId = storeIdOverride || selectedStore?.id || null;
  const activeStoreName = storeNameOverride || selectedStore?.name || '';
  const [codes, setCodes] = useState([]);
  const [devices, setDevices] = useState([]);
  const [codesLoading, setCodesLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [includeUsed, setIncludeUsed] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  
  // Generate code form (no role needed)
  const [newCode, setNewCode] = useState({
    expires_at: '',
    max_uses: 1,
    notes: ''
  });
  
  // User assignment
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    device_pin: '',
    permissions: {
      can_scan_barcode: true,
      can_adjust_inventory: true,
      can_create_orders: false,
      can_approve_orders: false,
      can_view_reports: false,
      can_edit_products: false,
      can_manage_devices: false,
      can_transfer_inventory: false,
      can_mark_damaged: true,
      can_receive_inventory: true
    }
  });

  useEffect(() => {
    if (!activeStoreId) {
      setDevices([]);
      setCodes([]);
      setCodesLoading(false);
      return;
    }

    if (isSuperAdmin) {
      loadCodes(activeStoreId);
    } else {
      setCodes([]);
      setCodesLoading(false);
    }
    loadDevices(activeStoreId);
  }, [activeStoreId, includeUsed, includeInactive, isSuperAdmin]);

  const loadCodes = async (storeId = activeStoreId) => {
    if (!storeId || !isSuperAdmin) {
      setCodesLoading(false);
      return;
    }
    try {
      setCodesLoading(true);
      const response = await mobileDevicesAPI.getCodes(storeId, includeUsed);
      setCodes(response.data.codes || []);
    } catch (error) {
      console.error('Error loading codes:', error);
      alert('Failed to load registration codes');
    } finally {
      setCodesLoading(false);
    }
  };

  const loadDevices = async (storeId = activeStoreId) => {
    if (!storeId) return;
    try {
      const response = isSuperAdmin
        ? await mobileDevicesAPI.getDevices(storeId, includeInactive)
        : await mobileDevicesAPI.getAssignableDevices(storeId, includeInactive);
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const loadUsers = async (storeId = activeStoreId) => {
    if (!storeId) return;
    try {
      const response = isSuperAdmin
        ? await mobileDevicesAPI.getUsers(storeId)
        : await mobileDevicesAPI.getAssignableUsers(storeId);
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleGenerateCode = async () => {
    if (!activeStoreId || !isSuperAdmin) return;
    try {
      const response = await mobileDevicesAPI.generateCode(activeStoreId, {
        expires_at: newCode.expires_at || null,
        max_uses: parseInt(newCode.max_uses) || 1,
        notes: newCode.notes || null
      });
      
      alert(`Registration code generated: ${response.data.code.code}\n\nShare this code with the device user to link their device. After registration, assign a user to the device.`);
      setShowGenerateModal(false);
      setNewCode({ expires_at: '', max_uses: 1, notes: '' });
      loadCodes();
    } catch (error) {
      console.error('Error generating code:', error);
      alert('Failed to generate code: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAssignUser = async () => {
    if (!selectedDevice || !assignForm.user_id || !activeStoreId) {
      alert('Please select a user');
      return;
    }
    
    // Check if user is employee and PIN is required
    const selectedUser = users.find(u => u.id === assignForm.user_id);
    if (selectedUser && selectedUser.role === 'employee' && !assignForm.device_pin) {
      alert('Device PIN is required for employee users');
      return;
    }
    
    // Validate PIN format (4-6 digits)
    if (assignForm.device_pin && (!/^\d{4,6}$/.test(assignForm.device_pin))) {
      alert('PIN must be 4-6 digits');
      return;
    }
    
    try {
      if (isSuperAdmin) {
        await mobileDevicesAPI.assignUser(
          selectedDevice.device_id,
          assignForm.user_id,
          assignForm.permissions,
          assignForm.device_pin || null
        );
      } else {
        await mobileDevicesAPI.assignEmployee(activeStoreId, selectedDevice.device_id, {
          user_id: assignForm.user_id,
          device_pin: assignForm.device_pin || null,
          permissions: assignForm.permissions,
        });
      }
      alert('User assigned successfully');
      setShowAssignModal(false);
      setSelectedDevice(null);
      setAssignForm({
        user_id: '',
        device_pin: '',
        permissions: {
          can_scan_barcode: true,
          can_adjust_inventory: true,
          can_create_orders: false,
          can_approve_orders: false,
          can_view_reports: false,
          can_edit_products: false,
          can_manage_devices: false,
          can_transfer_inventory: false,
          can_mark_damaged: true,
          can_receive_inventory: true
        }
      });
      loadDevices();
    } catch (error) {
      console.error('Error assigning user:', error);
      alert('Failed to assign user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUnassignUser = async (deviceId) => {
    if (!confirm('Are you sure you want to unassign the user from this device?')) return;
    try {
      if (isSuperAdmin) {
        await mobileDevicesAPI.unassignUser(deviceId);
      } else {
        await mobileDevicesAPI.unassignEmployee(activeStoreId, deviceId);
      }
      loadDevices();
    } catch (error) {
      console.error('Error unassigning user:', error);
      alert('Failed to unassign user');
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to unregister this device? This will allow it to be registered again with a new code.')) return;
    try {
      await mobileDevicesAPI.deleteDevice(deviceId);
      alert('Device unregistered successfully. It can now be registered again with a new code.');
      loadDevices();
    } catch (error) {
      console.error('Error deleting device:', error);
      alert('Failed to unregister device: ' + (error.response?.data?.error || error.message));
    }
  };

  const openAssignModal = async (device) => {
    setSelectedDevice(device);
    
    // Load existing permissions if user is assigned
    let existingPermissions = {
      can_scan_barcode: true,
      can_adjust_inventory: true,
      can_create_orders: false,
      can_approve_orders: false,
      can_view_reports: false,
      can_edit_products: false,
      can_manage_devices: false,
      can_transfer_inventory: false,
      can_mark_damaged: true,
      can_receive_inventory: true
    };
    
    if (device.user_id) {
      try {
        const response = await mobileDevicesAPI.getPermissions(device.device_id);
        if (response.data.permissions) {
          existingPermissions = response.data.permissions;
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
      }
    }
    
    setAssignForm({
      user_id: device.user_id || '',
      device_pin: '', // Never show existing PIN for security
      permissions: existingPermissions
    });
    loadUsers();
    setShowAssignModal(true);
  };

  const handleDeactivateCode = async (codeId) => {
    if (!confirm('Are you sure you want to deactivate this code?')) return;
    try {
      await mobileDevicesAPI.deactivateCode(codeId);
      loadCodes();
    } catch (error) {
      console.error('Error deactivating code:', error);
      alert('Failed to deactivate code');
    }
  };

  const handleReactivateCode = async (codeId) => {
    try {
      await mobileDevicesAPI.reactivateCode(codeId);
      loadCodes();
    } catch (error) {
      console.error('Error reactivating code:', error);
      alert('Failed to reactivate code');
    }
  };

  const handleDeleteCode = async (codeId) => {
    if (!confirm('Are you sure you want to delete this code? This cannot be undone.')) return;
    try {
      await mobileDevicesAPI.deleteCode(codeId);
      loadCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
      alert('Failed to delete code: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleLockDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to lock this device?')) return;
    try {
      await mobileDevicesAPI.lockDevice(deviceId);
      loadDevices();
    } catch (error) {
      console.error('Error locking device:', error);
      alert('Failed to lock device');
    }
  };

  const handleUnlockDevice = async (deviceId) => {
    try {
      await mobileDevicesAPI.unlockDevice(deviceId);
      loadDevices();
    } catch (error) {
      console.error('Error unlocking device:', error);
      alert('Failed to unlock device');
    }
  };

  const handleDeactivateDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to deactivate this device?')) return;
    try {
      await mobileDevicesAPI.deactivateDevice(deviceId);
      loadDevices();
    } catch (error) {
      console.error('Error deactivating device:', error);
      alert('Failed to deactivate device');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Code copied to clipboard!');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (!activeStoreId) {
    return (
      <div className={`${embedded ? '' : 'p-6'} text-center text-gray-500`}>
        {embedded
          ? 'Store information unavailable. Please reload the page.'
          : 'Please select a store to manage handheld devices.'}
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'p-6'}>
      {!embedded && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Handheld Device Management</h2>
          {isSuperAdmin ? (
            <p className="text-sm text-gray-600">
              Generate registration codes to link Android devices to this store. Each code can be used to register one device with specific access permissions.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Devices are provisioned by Super Admins. Once a device is registered for your store you can assign employees and manage their PIN access below.
            </p>
          )}
        </div>
      )}

      {isSuperAdmin && (
        <>
          <div className="mb-6">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
            >
              + Generate Registration Code
            </button>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Registration Codes</h3>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={includeUsed}
                  onChange={(e) => setIncludeUsed(e.target.checked)}
                  className="mr-2"
                />
                Show used codes
              </label>
            </div>

            {codesLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : codes.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                No registration codes found. Generate one to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uses</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {codes.map((code) => (
                      <tr key={code.id} className={!code.is_active ? 'bg-gray-50' : ''}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-lg">{code.code}</span>
                            <button
                              onClick={() => copyToClipboard(code.code)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Copy code"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {code.is_used && code.current_uses >= code.max_uses ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700">Used</span>
                          ) : !code.is_active ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-200 text-yellow-700">Inactive</span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-200 text-green-700">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {code.current_uses} / {code.max_uses}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {code.expires_at ? formatDate(code.expires_at) : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {code.created_by_name || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {code.is_active ? (
                              <button
                                onClick={() => handleDeactivateCode(code.id)}
                                className="text-yellow-600 hover:text-yellow-800 text-sm"
                                title="Deactivate"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivateCode(code.id)}
                                className="text-green-600 hover:text-green-800 text-sm"
                                title="Reactivate"
                              >
                                Reactivate
                              </button>
                            )}
                            {(!code.is_used || code.current_uses === 0) && (
                              <button
                                onClick={() => handleDeleteCode(code.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Delete"
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
          </div>
        </>
      )}

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Registered Devices</h3>
          {isSuperAdmin && (
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="mr-2"
              />
              Show inactive devices
            </label>
          )}
        </div>

        {devices.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            {isSuperAdmin
              ? 'No devices registered yet. Generate a code and have users register their devices.'
              : 'No handheld devices are currently assigned to this store. Ask a Super Admin to register one for you.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Seen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {devices.map((device) => (
                  <tr key={device.id} className={!device.is_active ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-3 font-medium">{device.device_name || 'Unknown Device'}</td>
                    <td className="px-4 py-3">
                      {device.user_name ? (
                        <div>
                          <div className="font-medium">{device.user_name}</div>
                          <div className="text-xs text-gray-500">{device.user_email}</div>
                          <div className="text-xs">
                            <span
                              className={`px-1 py-0.5 rounded ${
                                device.user_role === 'admin'
                                  ? 'bg-red-100 text-red-800'
                                  : device.user_role === 'manager'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {device.user_role}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No user assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {device.is_locked ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-200 text-red-700">Locked</span>
                      ) : !device.is_active ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700">Inactive</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-200 text-green-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {device.last_seen_at ? formatDate(device.last_seen_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(device.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {canManageAssignments && (
                          <button
                            onClick={() => openAssignModal(device)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                            title={device.user_id ? 'Change User/Permissions' : 'Assign User'}
                          >
                            {device.user_id ? 'Edit User' : 'Assign User'}
                          </button>
                        )}
                        {canManageAssignments && device.user_id && (
                          <button
                            onClick={() => handleUnassignUser(device.device_id)}
                            className="text-orange-600 hover:text-orange-800 text-sm"
                            title="Unassign User"
                          >
                            Unassign
                          </button>
                        )}
                        {isSuperAdmin && (
                          <>
                            {device.is_locked ? (
                              <button
                                onClick={() => handleUnlockDevice(device.device_id)}
                                className="text-green-600 hover:text-green-800 text-sm"
                                title="Unlock"
                              >
                                Unlock
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLockDevice(device.device_id)}
                                className="text-yellow-600 hover:text-yellow-800 text-sm"
                                title="Lock"
                              >
                                Lock
                              </button>
                            )}
                            {device.is_active && (
                              <button
                                onClick={() => handleDeactivateDevice(device.device_id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Deactivate"
                              >
                                Deactivate
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDevice(device.device_id)}
                              className="text-red-700 hover:text-red-900 text-sm font-semibold"
                              title="Unregister Device (allows re-registration)"
                            >
                              Unregister
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Code Modal */}
      {isSuperAdmin && showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Generate Registration Code</h3>
              
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This is a generic registration code. After the device is registered, you can assign a user and customize their permissions.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Uses (default: 1)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCode.max_uses}
                    onChange={(e) => setNewCode({ ...newCode, max_uses: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={newCode.expires_at}
                    onChange={(e) => setNewCode({ ...newCode, expires_at: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={newCode.notes}
                    onChange={(e) => setNewCode({ ...newCode, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows="3"
                    placeholder="e.g., For new employee device"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setNewCode({ expires_at: '', max_uses: 1, notes: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateCode}
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
                >
                  Generate Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign User Modal */}
      {showAssignModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-8">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {selectedDevice.user_id ? 'Edit User Assignment' : 'Assign User to Device'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select User *
                  </label>
                  <select
                    value={assignForm.user_id}
                    onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">-- Select a user --</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.email}) - {user.role}
                      </option>
                    ))}
                  </select>
                </div>

                {assignForm.user_id && (() => {
                  const selectedUser = users.find(u => u.id === assignForm.user_id);
                  const isEmployee = selectedUser?.role === 'employee';
                  const isAdminOrManager = selectedUser?.role === 'admin' || selectedUser?.role === 'super_admin' || selectedUser?.role === 'manager';
                  
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Device PIN {isEmployee && <span className="text-red-500">*</span>}
                        {isAdminOrManager && <span className="text-gray-500 text-xs ml-2">(Optional - can use master PIN instead)</span>}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={assignForm.device_pin}
                        onChange={(e) => {
                          // Only allow digits
                          const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                          setAssignForm({ ...assignForm, device_pin: value });
                        }}
                        placeholder="Enter 4-6 digit PIN"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                      {isEmployee && (
                        <p className="text-xs text-gray-500 mt-1">
                          Required for employee login on this device
                        </p>
                      )}
                      {isAdminOrManager && (
                        <p className="text-xs text-gray-500 mt-1">
                          Optional. If not set, user can use their master PIN (set in user settings).
                        </p>
                      )}
                    </div>
                  );
                })()}

                {assignForm.user_id && (
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Device Permissions</h4>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                      {(() => {
                        const selectedUser = users.find(u => u.id === assignForm.user_id);
                        const userRole = selectedUser?.role || '';
                        const isAdmin = userRole === 'admin' || userRole === 'super_admin';
                        const isManager = userRole === 'manager';
                        const isEmployee = userRole === 'employee';

                        return (
                          <>
                            {isAdmin && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                                <p className="text-sm text-blue-800 font-medium">
                                  ⚠️ Admin users have full access to all features. Permission settings below will be overridden.
                                </p>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              {/* Basic Permissions - Available to all */}
                              <div className="space-y-3">
                                <h5 className="font-medium text-gray-700 text-sm">Basic Access</h5>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_scan_barcode}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_scan_barcode: e.target.checked }
                                    })}
                                    disabled={isAdmin}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Scan Barcode</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_mark_damaged}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_mark_damaged: e.target.checked }
                                    })}
                                    disabled={isAdmin}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Mark Damaged</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_receive_inventory}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_receive_inventory: e.target.checked }
                                    })}
                                    disabled={isAdmin}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Receive Inventory</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_adjust_inventory}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_adjust_inventory: e.target.checked }
                                    })}
                                    disabled={isAdmin || isEmployee}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Adjust Inventory</span>
                                </label>
                              </div>

                              {/* Advanced Permissions - Manager/Admin only */}
                              <div className="space-y-3">
                                <h5 className="font-medium text-gray-700 text-sm">Advanced Access</h5>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_edit_products}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_edit_products: e.target.checked }
                                    })}
                                    disabled={isAdmin || isEmployee}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Edit Products</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_create_orders}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_create_orders: e.target.checked }
                                    })}
                                    disabled={isAdmin || isEmployee}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Create Orders</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_approve_orders}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_approve_orders: e.target.checked }
                                    })}
                                    disabled={isAdmin || isEmployee}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Approve Orders</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_transfer_inventory}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_transfer_inventory: e.target.checked }
                                    })}
                                    disabled={isAdmin || isEmployee}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Transfer Inventory</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_view_reports}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_view_reports: e.target.checked }
                                    })}
                                    disabled={isAdmin || isEmployee}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">View Reports</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.permissions.can_manage_devices}
                                    onChange={(e) => setAssignForm({
                                      ...assignForm,
                                      permissions: { ...assignForm.permissions, can_manage_devices: e.target.checked }
                                    })}
                                    disabled={isAdmin || isEmployee}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Manage Devices</span>
                                </label>
                              </div>
                            </div>

                            {(isEmployee || isManager) && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="text-xs text-gray-500">
                                  <strong>Note:</strong> Some permissions are restricted based on user role. Employees have limited access, while Managers can be granted additional permissions.
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedDevice(null);
                    setAssignForm({
                      user_id: '',
                      device_pin: '',
                      permissions: {
                        can_scan_barcode: true,
                        can_adjust_inventory: true,
                        can_create_orders: false,
                        can_approve_orders: false,
                        can_view_reports: false,
                        can_edit_products: false,
                        can_manage_devices: false,
                        can_transfer_inventory: false,
                        can_mark_damaged: true,
                        can_receive_inventory: true
                      }
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignUser}
                  disabled={!assignForm.user_id}
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedDevice.user_id ? 'Update Assignment' : 'Assign User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HandheldDevices;

