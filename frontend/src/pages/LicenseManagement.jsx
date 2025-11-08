/**
 * License Management Page
 * 
 * Allows admins to manage store licenses with:
 * - License type, number, expiration date
 * - File uploads for license documents
 * - Renewal costs that auto-link to expenses
 * - Reminder system for expiring licenses
 */
import { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { storesAPI } from '../services/api';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LicenseManagement = () => {
  const { selectedStore: contextStore } = useStore();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(contextStore?.id || '');
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState(null);
  const [filter, setFilter] = useState('all'); // all, active, expired, expiring_soon
  const [expiringDays, setExpiringDays] = useState(30);
  
  const [formData, setFormData] = useState({
    license_type: '',
    license_number: '',
    expiration_date: '',
    renewal_cost: '',
    renewal_date: '',
    reminder_days_before: '30',
    notes: '',
    file: null
  });

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadLicenses();
    }
  }, [selectedStore, filter]);

  const loadStores = async () => {
    try {
      const response = await storesAPI.getAll();
      setStores(response.data.stores || []);
      if (response.data.stores?.length > 0 && !selectedStore) {
        setSelectedStore(response.data.stores[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadLicenses = async () => {
    if (!selectedStore) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const filters = {};
      
      if (filter === 'active') filters.active_only = true;
      if (filter === 'expired') filters.expired_only = true;
      if (filter === 'expiring_soon') filters.expiring_soon = expiringDays;
      
      const params = new URLSearchParams();
      if (filters.active_only) params.append('active_only', 'true');
      if (filters.expired_only) params.append('expired_only', 'true');
      if (filters.expiring_soon) params.append('expiring_soon', filters.expiring_soon);
      
      const response = await axios.get(
        `${API_BASE_URL}/api/store-licenses/store/${selectedStore}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setLicenses(response.data.licenses || []);
    } catch (error) {
      console.error('Error loading licenses:', error);
      alert('Error loading licenses: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const submitData = new FormData();
      
      submitData.append('license_type', formData.license_type);
      submitData.append('license_number', formData.license_number);
      submitData.append('expiration_date', formData.expiration_date);
      submitData.append('renewal_cost', formData.renewal_cost || '0');
      submitData.append('renewal_date', formData.renewal_date || '');
      submitData.append('reminder_days_before', formData.reminder_days_before || '30');
      submitData.append('notes', formData.notes || '');
      
      if (formData.file) {
        submitData.append('file', formData.file);
      }

      const url = editingLicense
        ? `${API_BASE_URL}/api/store-licenses/${editingLicense.id}`
        : `${API_BASE_URL}/api/store-licenses/store/${selectedStore}`;
      
      const method = editingLicense ? 'put' : 'post';

      await axios[method](url, submitData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowAddModal(false);
      setShowEditModal(false);
      setEditingLicense(null);
      resetForm();
      loadLicenses();
      alert(editingLicense ? 'License updated successfully' : 'License created successfully');
    } catch (error) {
      console.error('Error saving license:', error);
      alert('Error saving license: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (licenseId) => {
    if (!confirm('Are you sure you want to delete this license?')) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/store-licenses/${licenseId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      loadLicenses();
      alert('License deleted successfully');
    } catch (error) {
      console.error('Error deleting license:', error);
      alert('Error deleting license: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (licenseId, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/store-licenses/${licenseId}/file`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'license-document');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file: ' + (error.response?.data?.error || error.message));
    }
  };

  const resetForm = () => {
    setFormData({
      license_type: '',
      license_number: '',
      expiration_date: '',
      renewal_cost: '',
      renewal_date: '',
      reminder_days_before: '30',
      notes: '',
      file: null
    });
    setEditingLicense(null);
  };

  const handleEdit = (license) => {
    setEditingLicense(license);
    setFormData({
      license_type: license.license_type,
      license_number: license.license_number,
      expiration_date: license.expiration_date,
      renewal_cost: license.renewal_cost || '',
      renewal_date: license.renewal_date || '',
      reminder_days_before: license.reminder_days_before?.toString() || '30',
      notes: license.notes || '',
      file: null
    });
    setShowEditModal(true);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntilExpiration = (expirationDate) => {
    if (!expirationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpirationStatus = (license) => {
    const daysUntil = getDaysUntilExpiration(license.expiration_date);
    if (daysUntil < 0) {
      return { text: 'Expired', color: 'text-red-600 bg-red-50' };
    } else if (daysUntil <= 30) {
      return { text: `Expires in ${daysUntil} days`, color: 'text-orange-600 bg-orange-50' };
    } else {
      return { text: 'Active', color: 'text-green-600 bg-green-50' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">License Management</h1>
          <p className="text-gray-600">Manage store licenses, renewal dates, and costs</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Add License
        </button>
      </div>

      {/* Store Selection and Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Store
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a store</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Licenses</option>
              <option value="active">Active Only</option>
              <option value="expired">Expired</option>
              <option value="expiring_soon">Expiring Soon</option>
            </select>
          </div>

          {filter === 'expiring_soon' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Days Before Expiration
              </label>
              <input
                type="number"
                value={expiringDays}
                onChange={(e) => setExpiringDays(parseInt(e.target.value) || 30)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="365"
              />
            </div>
          )}
        </div>
      </div>

      {/* Licenses Table */}
      {loading ? (
        <div className="text-center py-8">Loading licenses...</div>
      ) : licenses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No licenses found. Add your first license to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  License Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  License Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiration Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Renewal Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reminder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {licenses.map((license) => {
                const status = getExpirationStatus(license);
                return (
                  <tr key={license.id} className={license.is_expired ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {license.license_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {license.license_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(license.expiration_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(license.renewal_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {license.reminder_days_before} days before
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {license.file_path && (
                          <button
                            onClick={() => handleDownload(license.id, license.file_name)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Download
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(license)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(license.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingLicense ? 'Edit License' : 'Add New License'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Type *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.license_type}
                      onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Business License, Lottery License"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiration Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.expiration_date}
                      onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Renewal Date
                    </label>
                    <input
                      type="date"
                      value={formData.renewal_date}
                      onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Renewal Cost
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.renewal_cost}
                      onChange={(e) => setFormData({ ...formData, renewal_cost: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This will automatically create an expense entry
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reminder Days Before
                    </label>
                    <input
                      type="number"
                      value={formData.reminder_days_before}
                      onChange={(e) => setFormData({ ...formData, reminder_days_before: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="365"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Days before expiration to send reminder
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload License Document
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, images, or documents (max 10MB)
                  </p>
                  {editingLicense && editingLicense.file_name && (
                    <p className="text-xs text-blue-600 mt-1">
                      Current file: {editingLicense.file_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="3"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Additional notes about this license..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : (editingLicense ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LicenseManagement;

