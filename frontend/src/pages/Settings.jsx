import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import ManageBanks from '../components/settings/ManageBanks';
import ManageCreditCards from '../components/settings/ManageCreditCards';
import ManageDepartments from '../components/settings/ManageDepartments';
import ManageVendors from '../components/settings/ManageVendors';
import ManageChartOfAccounts from '../components/settings/ManageChartOfAccounts';
import ManageExpenseTypes from '../components/settings/ManageExpenseTypes';
import OtherIncome from '../components/settings/OtherIncome';
import StoreProfile from '../components/settings/StoreProfile';
import ManageStoreManagers from '../components/settings/ManageStoreManagers';
import ManageTaxes from '../components/settings/ManageTaxes';
import FeatureAddons from '../components/settings/FeatureAddons';
import SubscriptionDetails from '../components/settings/SubscriptionDetails';
import Integrations from '../components/settings/Integrations';
import CashDrawerSettings from '../components/settings/CashDrawerSettings';
import CashDrawerCalculationConfig from '../components/settings/CashDrawerCalculationConfig';
import HandheldDevices from '../components/settings/HandheldDevices';

const Settings = () => {
  const { user } = useAuth();
  const { isFeatureEnabled } = useStore();
  const [activeTab, setActiveTab] = useState('store-profile');
  const SuperAdminSecurity = lazy(() => import('../components/settings/SuperAdminSecurity'));

  // Listen for custom event to set active tab (e.g., from dashboard)
  useEffect(() => {
    const handleSetTab = (event) => {
      if (event.detail && tabs.find(t => t.id === event.detail)) {
        setActiveTab(event.detail);
      }
    };
    window.addEventListener('setSettingsTab', handleSetTab);
    return () => window.removeEventListener('setSettingsTab', handleSetTab);
  }, []);

  // Admin, Super Admin, and Manager can access settings
  if (user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'manager') {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500">You do not have permission to access settings.</p>
      </div>
    );
  }

  const handheldTabEnabled = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'manager' || isFeatureEnabled('handheld_devices');

  const tabs = [
    { id: 'store-profile', label: 'Store Profile' },
    { id: 'cash-drawer-settings', label: 'Cash Drawer Settings' },
    ...(user?.role === 'super_admin' ? [{ id: 'cash-drawer-calculation', label: 'Cash Drawer Calculations' }] : []),
    ...(user?.role === 'super_admin' ? [{ id: 'super-admin-security', label: 'Super Admin' }] : []),
    { id: 'integrations', label: 'Integrations' },
    { id: 'subscription-details', label: 'My Subscription' },
    { id: 'feature-addons', label: 'Feature Addons' },
    { id: 'manage-user', label: 'Manage User' },
    { id: 'manage-departments', label: 'Manage Departments' },
    { id: 'manage-vendor', label: 'Manage Vendor' },
    { id: 'manage-expense-type', label: 'Manage Expense Type' },
    { id: 'other-income', label: 'Other Income' },
    { id: 'manage-banks', label: 'Manage Banks' },
    { id: 'manage-credit-cards', label: 'Manage Credit Cards' },
    { id: 'chart-of-accounts', label: 'Chart of Accounts' },
    { id: 'manage-taxes', label: 'Local Taxes' },
    ...(handheldTabEnabled ? [{ id: 'handheld-devices', label: 'Handheld Devices' }] : []),
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'store-profile':
        return <StoreProfile />;
      case 'cash-drawer-settings':
        return <CashDrawerSettings />;
      case 'cash-drawer-calculation':
        return <CashDrawerCalculationConfig />;
      case 'super-admin-security':
        return (
          <Suspense fallback={<div className="p-6 text-gray-600">Loading…</div>}>
            <SuperAdminSecurity />
          </Suspense>
        );
      case 'manage-user':
        return <ManageStoreManagers />;
      case 'manage-departments':
        return <ManageDepartments />;
      case 'manage-vendor':
        return <ManageVendors />;
      case 'manage-expense-type':
        return <ManageExpenseTypes />;
      case 'other-income':
        return <OtherIncome />;
      case 'manage-banks':
        return <ManageBanks />;
      case 'manage-credit-cards':
        return <ManageCreditCards />;
      case 'chart-of-accounts':
        return <ManageChartOfAccounts />;
      case 'manage-taxes':
        return <ManageTaxes />;
      case 'subscription-details':
        return <SubscriptionDetails />;
      case 'feature-addons':
        return <FeatureAddons />;
      case 'integrations':
        return <Integrations />;
      case 'handheld-devices':
        return <HandheldDevices />;
      default:
        return <StoreProfile />;
    }
  };

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      
      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow mb-6 w-full">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-[#2d8659] text-[#2d8659]'
                    : 'border-transparent text-gray-600 hover:text-[#2d8659] hover:border-[#2d8659]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow w-full overflow-x-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default Settings;

