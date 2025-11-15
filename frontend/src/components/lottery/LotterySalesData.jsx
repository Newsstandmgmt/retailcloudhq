import { useState } from 'react';
import DailySales from './salesData/DailySales';
import WeeklySales from './salesData/WeeklySales';
import ThirteenWeekAverage from './salesData/ThirteenWeekAverage';
import WeeklySettlement from './salesData/WeeklySettlement';

const LotterySalesData = ({ storeId }) => {
  const [activeTab, setActiveTab] = useState('daily');

  const tabs = [
    { id: 'daily', name: 'Daily Sales', icon: '📅' },
    { id: 'weekly', name: 'Weekly Sales', icon: '📆' },
    { id: '13week', name: '13 Week Average', icon: '📊' },
    { id: 'settlement', name: 'Weekly Settlement', icon: '💵' },
  ];

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Lottery Sales Data</h2>
            <p className="text-gray-600">
              Manage lottery sales reports pulled automatically from Gmail integrations or entered manually.
            </p>
          </div>
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
        {activeTab === 'daily' && <DailySales storeId={storeId} key={`daily-${storeId}`} />}
        {activeTab === 'weekly' && <WeeklySales storeId={storeId} key={`weekly-${storeId}`} />}
        {activeTab === '13week' && <ThirteenWeekAverage storeId={storeId} key={`13week-${storeId}`} />}
        {activeTab === 'settlement' && <WeeklySettlement storeId={storeId} key={`settlement-${storeId}`} />}
      </div>
    </div>
  );
};

export default LotterySalesData;

