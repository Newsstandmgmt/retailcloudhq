import { useState } from 'react';
import { useStore } from '../../contexts/StoreContext';
import SquareIntegrationSettings from './SquareIntegrationSettings';
import LotteryEmailSettings from '../lottery/LotteryEmailSettings';

const Integrations = () => {
  const { selectedStore } = useStore();
  const [activeTab, setActiveTab] = useState('square');

  if (!selectedStore) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Please select a store to manage integrations.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'square', label: 'Square POS', icon: '💳' },
    { id: 'gmail', label: 'Gmail Lottery Import', icon: '📧' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Integrations</h2>
        <p className="text-gray-600">
          Connect Square for credit card sales and Gmail for automated lottery report imports. These
          integrations keep your revenue and lottery data in sync with minimal manual entry.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-[#2d8659] text-[#2d8659]'
                    : 'border-transparent text-gray-600 hover:text-[#2d8659] hover:border-[#2d8659]'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'square' && (
            <SquareIntegrationSettings storeId={selectedStore.id} />
          )}
          {activeTab === 'gmail' && (
            <GmailIntegration storeId={selectedStore.id} />
          )}
        </div>
      </div>
    </div>
  );
};

const GmailIntegration = ({ storeId }) => (
  <div>
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Gmail Integration</h3>
      <p className="text-gray-600 text-sm">
        Connect your Gmail account to automatically import lottery reports from official emails. The
        system will read messages, parse attachments, and keep your lottery sales up to date.
      </p>
    </div>
    <LotteryEmailSettings storeId={storeId} />
  </div>
);

export default Integrations;
