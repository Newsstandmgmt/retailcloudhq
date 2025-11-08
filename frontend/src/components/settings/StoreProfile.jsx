import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { storesAPI } from '../../services/api';

const StoreProfile = () => {
  const { selectedStore, changeStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    store_type: 'other',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    enable_newspaper_sales: false
  });

  useEffect(() => {
    if (selectedStore) {
      loadStoreProfile();
    }
  }, [selectedStore]);

  const loadStoreProfile = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await storesAPI.getById(selectedStore.id);
      const store = response.data.store;
      setFormData({
        name: store.name || '',
        store_type: store.store_type || 'other',
        address: store.address || '',
        city: store.city || '',
        state: store.state || '',
        zip_code: store.zip_code || '',
        phone: store.phone || '',
        enable_newspaper_sales: store.enable_newspaper_sales || false
      });
    } catch (error) {
      console.error('Error loading store profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedStore) return;

    try {
      await storesAPI.update(selectedStore.id, formData);
      alert('Store profile updated successfully!');
      // Reload stores to update the context
      if (changeStore) {
        changeStore(selectedStore.id);
      }
    } catch (error) {
      alert('Error updating store profile: ' + (error.response?.data?.error || error.message));
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

  return (
    <div className="p-6 w-full min-w-0">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Store Profile</h2>

      <form onSubmit={handleUpdate}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Store Name *
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
              Store Type *
            </label>
            <select
              value={formData.store_type}
              onChange={(e) => setFormData({ ...formData, store_type: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
              required
            >
              <option value="galaxy">Galaxy</option>
              <option value="newsstand">Newsstand</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zip Code
            </label>
            <input
              type="text"
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
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

          <div className="md:col-span-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.enable_newspaper_sales}
                onChange={(e) => setFormData({ ...formData, enable_newspaper_sales: e.target.checked })}
                className="mr-2 h-4 w-4 text-[#2d8659] focus:ring-[#2d8659] border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable Newspaper Sales (If enabled, you can enter newspaper sales amounts. If disabled, use vendor payments from register cash.)
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className="px-6 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
          >
            Update Profile
          </button>
        </div>
      </form>
    </div>
  );
};

export default StoreProfile;

