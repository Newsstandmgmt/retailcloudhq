import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';

const DailyReportSettings = () => {
  const { selectedStore } = useStore();
  const [settings, setSettings] = useState({
    default_bank: '',
    default_atm_bank: '',
    default_lottery_bank: '',
    default_credit_card_bank: '',
    auto_sync_enabled: false,
    sync_frequency: 'daily'
  });

  useEffect(() => {
    if (selectedStore) {
      // Load settings from store or defaults
      // This is a placeholder - you can extend this to load from database
    }
  }, [selectedStore]);

  const handleSave = async (e) => {
    e.preventDefault();
    // Placeholder for saving settings
    alert('Daily Report Settings saved successfully! (This is a placeholder)');
  };

  if (!selectedStore) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  return (
    <div className="p-6 w-full min-w-0">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Daily Report Settings</h2>

      <form onSubmit={handleSave}>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto Sync Enabled
            </label>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.auto_sync_enabled}
                onChange={(e) => setSettings({ ...settings, auto_sync_enabled: e.target.checked })}
                className="w-4 h-4 text-[#2d8659] border-gray-300 rounded focus:ring-[#2d8659]"
              />
              <span className="ml-2 text-sm text-gray-600">Enable automatic data sync from connected integrations</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sync Frequency
            </label>
            <select
              value={settings.sync_frequency}
              onChange={(e) => setSettings({ ...settings, sync_frequency: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-4">
              Configure default banks for different transaction types. These can be set in the "Manage Banks" section.
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className="px-6 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default DailyReportSettings;

