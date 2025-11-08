import { useState } from 'react';
import DailySales from './salesData/DailySales';
import WeeklySales from './salesData/WeeklySales';
import ThirteenWeekAverage from './salesData/ThirteenWeekAverage';
import WeeklySettlement from './salesData/WeeklySettlement';
import { googleSheetsAPI } from '../../services/api';

const LotterySalesData = ({ storeId }) => {
  const [activeTab, setActiveTab] = useState('daily');
  const [syncing, setSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs = [
    { id: 'daily', name: 'Daily Sales', icon: '📅', syncType: 'lottery' },
    { id: 'weekly', name: 'Weekly Sales', icon: '📆', syncType: 'lottery_weekly' },
    { id: '13week', name: '13 Week Average', icon: '📊', syncType: null },
    { id: 'settlement', name: 'Weekly Settlement', icon: '💵', syncType: null },
  ];

  const handleManualSync = async () => {
    const currentTab = tabs.find(t => t.id === activeTab);
    if (!currentTab?.syncType) {
      alert('Manual sync is not available for this data type. Use integrations to import this data.');
      return;
    }

    if (!window.confirm(`Sync ${currentTab.name} data from Google Sheets integration?`)) {
      return;
    }

    setSyncing(true);
    try {
      await googleSheetsAPI.sync(storeId, currentTab.syncType);
      // Trigger refresh after sync completes
      setTimeout(() => {
        setRefreshKey(prev => prev + 1);
        setSyncing(false);
      }, 1000);
    } catch (error) {
      alert('Sync failed: ' + (error.response?.data?.error || error.message));
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Lottery Sales Data</h2>
            <p className="text-gray-600">Manage lottery sales reports - automatically pulled from integrations (Google Sheets/Gmail) or manually entered</p>
          </div>
          {tabs.find(t => t.id === activeTab)?.syncType && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#25634d] disabled:opacity-50 flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Syncing...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  Sync from Google Sheets
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
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
        {activeTab === 'daily' && <DailySales storeId={storeId} key={`daily-${storeId}-${refreshKey}`} />}
        {activeTab === 'weekly' && <WeeklySales storeId={storeId} key={`weekly-${storeId}-${refreshKey}`} />}
        {activeTab === '13week' && <ThirteenWeekAverage storeId={storeId} key={`13week-${storeId}-${refreshKey}`} />}
        {activeTab === 'settlement' && <WeeklySettlement storeId={storeId} key={`settlement-${storeId}-${refreshKey}`} />}
      </div>
    </div>
  );
};

export default LotterySalesData;

