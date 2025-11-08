import { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { inventoryOrdersAPI } from '../services/api';

export default function Orders() {
  const { selectedStore } = useStore();
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editQuantities, setEditQuantities] = useState({});
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'delivered'
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (selectedStore) {
      loadOrderItems();
    }
  }, [selectedStore, activeTab]);

  useEffect(() => {
    if (selectedItem?.order_history) {
      const initialValues = {};
      selectedItem.order_history.forEach((entry) => {
        initialValues[entry.order_item_id] = entry.quantity;
      });
      setEditQuantities(initialValues);
    } else {
      setEditQuantities({});
    }
  }, [selectedItem]);

  const loadOrderItems = async () => {
    try {
      setLoading(true);
      setSelectedItem(null);
      const filters = {};
      // Filter by tab: pending shows non-delivered, delivered shows delivered
      if (activeTab === 'delivered') {
        filters.itemStatus = 'delivered';
      } else {
        // For pending tab, exclude delivered items
        filters.itemStatus = 'pending,partially_delivered';
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }
      const response = await inventoryOrdersAPI.getAllOrderItems(selectedStore.id, filters);
      const items = (response.data.items || []).map((item) => ({
        ...item,
        order_history: (item.order_history || []).sort(
          (a, b) => new Date(a.order_date) - new Date(b.order_date)
        ),
      }));
      setOrderItems(items);
    } catch (error) {
      console.error('Error loading order items:', error);
      alert('Failed to load order items');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (itemId, quantity) => {
    try {
      await inventoryOrdersAPI.updateItemQuantity(itemId, quantity);
      alert('Quantity updated successfully');
      loadOrderItems();
      setSelectedItem(null);
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity');
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!confirm('Are you sure you want to remove this item from the order?')) {
      return;
    }
    try {
      await inventoryOrdersAPI.removeItem(itemId);
      alert('Item removed successfully');
      loadOrderItems();
      setSelectedItem(null);
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Failed to remove item');
    }
  };

  const handleMarkDelivered = async (itemId, quantityDelivered = null) => {
    try {
      await inventoryOrdersAPI.markItemDelivered(itemId, quantityDelivered);
      alert('Item marked as delivered');
      // If we're on pending tab and item is now delivered, switch to delivered tab
      if (activeTab === 'pending') {
        // Reload will automatically filter, but we might want to switch tabs
        loadOrderItems();
      } else {
        loadOrderItems();
      }
      setSelectedItem(null);
    } catch (error) {
      console.error('Error marking delivered:', error);
      alert('Failed to mark item as delivered');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      partially_delivered: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading order items...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Orders</h1>
        <p className="text-gray-600 mt-1">All order items from handheld devices</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-[#2d8659] text-[#2d8659]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Orders
          </button>
          <button
            onClick={() => setActiveTab('delivered')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'delivered'
                ? 'border-[#2d8659] text-[#2d8659]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Delivered Orders
          </button>
        </nav>
      </div>

      {/* Search */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search by Order ID, product, variant, or submitter..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && loadOrderItems()}
          className="flex-1 border border-gray-300 rounded-md px-4 py-2"
        />
        <button
          onClick={loadOrderItems}
          className="bg-[#2d8659] text-white px-4 py-2 rounded-md hover:bg-[#256b49]"
        >
          Search
        </button>
      </div>

      {/* Order Items List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Variant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Delivered
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pending
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orderItems.length === 0 ? (
              <tr>
                <td colSpan="11" className="px-6 py-4 text-center text-gray-500">
                  No order items found
                </td>
              </tr>
            ) : (
              orderItems.map((item) => {
                const pendingQty = item.pending_quantity || 0;
                const pendingDisplay = pendingQty > 0 ? `Quantity ${item.quantity} & Pending ${pendingQty}` : `Quantity ${item.quantity}`;
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.order_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.product_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.variant || '-'}
                        {pendingQty > 0 && (
                          <span className="ml-2 text-xs text-orange-600">
                            ({pendingDisplay})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.supplier || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.status !== 'delivered' ? (
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value);
                            if (newQty > 0) {
                              handleUpdateQuantity(item.id, newQty);
                            }
                          }}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      ) : (
                        <div className="text-sm text-gray-900">{item.quantity}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.quantity_delivered || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{pendingQty}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.submitted_by_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(item.order_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {item.status !== 'delivered' && (
                          <>
                            <button
                              onClick={() => handleMarkDelivered(item.id)}
                              className="text-green-600 hover:text-green-800"
                            >
                              Mark Delivered
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
