import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../contexts/StoreContext';
import { lotteryAPI } from '../services/api';
import BoxesView from '../components/lottery/BoxesView';
import DrawEntry from '../components/lottery/DrawEntry';
import DayClose from '../components/lottery/DayClose';
import LotteryReports from '../components/lottery/LotteryReports';
import LotterySettings from '../components/lottery/LotterySettings';
import LotterySalesData from '../components/lottery/LotterySalesData';

const Lottery = () => {
  const { selectedStore, isFeatureEnabled } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('boxes');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Check for OAuth callback success or error
  useEffect(() => {
    const emailConnected = searchParams.get('emailConnected');
    const accountId = searchParams.get('accountId');
    const error = searchParams.get('error');
    const errorMessage = searchParams.get('message');
    
    if (emailConnected === 'true') {
      setSuccessMessage('Gmail account connected successfully!');
      setActiveTab('settings');
      // Clear URL params
      setSearchParams({});
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } else if (error) {
      const message = errorMessage || 'Failed to connect Gmail account';
      setSuccessMessage(`Error: ${message}`);
      setActiveTab('settings');
      setSearchParams({});
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, [searchParams, setSearchParams]);

  if (!selectedStore) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <h2 className="text-lg font-semibold mb-2">No Store Selected</h2>
          <p>Please select a store from the dropdown above.</p>
        </div>
      </div>
    );
  }

  if (!isFeatureEnabled('lottery')) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <h2 className="text-lg font-semibold mb-2">Lottery Management Not Available</h2>
          <p>This feature is not enabled for {selectedStore?.name || 'this store'}. Please contact your administrator to enable the Lottery Management template.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'boxes', name: 'Instant Lottery (Boxes)', icon: '📦' },
    { id: 'draw', name: 'Draw/Online Lottery', icon: '🎲' },
    { id: 'dayclose', name: 'Day Close', icon: '🔒' },
    { id: 'sales-data', name: 'Lottery Sales Data', icon: '📈' },
    { id: 'reports', name: 'Reports', icon: '📊' },
    { id: 'settings', name: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="p-6">
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 text-green-800 border border-green-200 rounded">
          <div className="flex justify-between items-center">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-lg">×</button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lottery Management</h1>
        <p className="text-gray-600">Manage instant lottery packs and draw/online lottery entries</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                ${activeTab === tab.id
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'boxes' && <BoxesView storeId={selectedStore.id} />}
        {activeTab === 'draw' && <DrawEntry storeId={selectedStore.id} />}
        {activeTab === 'dayclose' && <DayClose storeId={selectedStore.id} />}
        {activeTab === 'sales-data' && <LotterySalesData storeId={selectedStore.id} />}
        {activeTab === 'reports' && <LotteryReports storeId={selectedStore.id} />}
        {activeTab === 'settings' && <LotterySettings storeId={selectedStore.id} />}
      </div>
    </div>
  );
};

export default Lottery;

