import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { purchaseInvoicesAPI } from '../../services/api';
import CopyToStoreModal from './CopyToStoreModal';

const ManageVendors = () => {
  const { selectedStore } = useStore();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    if (selectedStore) {
      loadVendors();
    }
  }, [selectedStore]);

  const loadVendors = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await purchaseInvoicesAPI.getVendors(selectedStore.id);
      setVendors(response.data.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!selectedStore || !formData.name.trim()) return;

    try {
      await purchaseInvoicesAPI.createVendor(selectedStore.id, formData);
      setShowAddModal(false);
      setFormData({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '' });
      loadVendors();
    } catch (error) {
      alert('Error adding vendor: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditVendor = async (e) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      await purchaseInvoicesAPI.updateVendor(editingId, formData);
      setEditingId(null);
      setFormData({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '' });
      loadVendors();
    } catch (error) {
      alert('Error updating vendor: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) {
      return;
    }

    try {
      await purchaseInvoicesAPI.deleteVendor(vendorId);
      loadVendors();
    } catch (error) {
      alert('Error deleting vendor: ' + (error.response?.data?.error || error.message));
    }
  };

  const startEdit = (vendor) => {
    setEditingId(vendor.id);
    setFormData({
      name: vendor.name || '',
      contact_name: vendor.contact_name || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      notes: vendor.notes || ''
    });
    setShowAddModal(true);
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

  return (
    <div className="p-6 w-full min-w-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage Vendor</h2>
        <div className="flex items-center gap-2">
          {vendors.length > 0 && (
            <button
              onClick={() => setShowCopyModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              title="Copy to other stores"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy to Store
            </button>
          )}
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '' });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        {vendors.map((vendor) => (
          <div key={vendor.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{vendor.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(vendor)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteVendor(vendor.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {vendor.contact_name && (
                <p><span className="text-gray-600">Contact:</span> {vendor.contact_name}</p>
              )}
              {vendor.email && (
                <p><span className="text-gray-600">Email:</span> {vendor.email}</p>
              )}
              {vendor.phone && (
                <p><span className="text-gray-600">Phone:</span> {vendor.phone}</p>
              )}
              {vendor.address && (
                <p><span className="text-gray-600">Address:</span> {vendor.address}</p>
              )}
              {vendor.notes && (
                <p><span className="text-gray-600">Notes:</span> {vendor.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {vendors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No vendors added yet. Click "Add Vendor" to get started.</p>
        </div>
      )}

      {/* Add/Edit Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Vendor' : 'Add Vendor'}</h2>
            <form onSubmit={editingId ? handleEditVendor : handleAddVendor}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows="2"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="3"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    setFormData({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  {editingId ? 'Update' : 'Add'} Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy to Store Modal */}
      <CopyToStoreModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        sourceStoreId={selectedStore?.id}
        copyType="vendors"
        onSuccess={() => {
          // Optionally reload or show success message
        }}
      />
    </div>
  );
};

export default ManageVendors;

