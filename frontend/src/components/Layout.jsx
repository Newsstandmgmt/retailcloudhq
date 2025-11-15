import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import NotificationBell from './NotificationBell';
import {
  DashboardIcon,
  UsersIcon,
  StoreIcon,
  CreditCardIcon,
  DocumentIcon,
  ChartIcon,
  ClipboardIcon,
  CurrencyDollarIcon,
  TicketIcon,
  BookIcon,
  CogIcon,
  CashIcon,
  ProductManagementIcon
} from './Icons';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { stores, selectedStore, changeStore, hasMultipleStores, isFeatureEnabled } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showStoreMenu, setShowStoreMenu] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Navigation items based on role (icon-based like Hisably)
  const getNavigation = () => {
    if (user?.role === 'super_admin') {
      return [
        { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
        { name: 'Admin Management', href: '/admin-management', icon: UsersIcon },
        { name: 'Stores', href: '/stores', icon: StoreIcon },
        { name: 'Subscriptions', href: '/subscriptions', icon: ClipboardIcon },
        { name: 'Billing', href: '/billing', icon: CreditCardIcon },
        { name: 'Feature Pricing', href: '/feature-pricing', icon: ClipboardIcon },
        { name: 'Statistics', href: '/statistics', icon: ChartIcon },
        { name: 'Audit Logs', href: '/audit-logs', icon: DocumentIcon },
        { name: 'Data Configuration', href: '/data-configuration', icon: CogIcon },
      ];
    }

    // Admin and Manager navigation (like Hisably)
    const allNavItems = [
      { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
      { name: 'Daily Analytics', href: '/business-analytics', icon: ChartIcon, feature: 'revenue' },
      { name: 'Daily Report', href: '/revenue', icon: DocumentIcon, hasSubmenu: true, feature: 'revenue' },
      {
        name: 'Expenses',
        href: '/expenses',
        icon: ClipboardIcon,
        hasSubmenu: true,
        submenu: [
          { name: 'All Expenses', href: '/expenses', feature: 'expenses' },
          { name: 'Recurring Expenses', href: '/recurring-expenses', feature: 'recurring_expenses' },
        ],
        feature: 'expenses',
      },
      { 
        name: 'Inventory Management', 
        href: '/inventory', 
        icon: ProductManagementIcon, 
        hasSubmenu: true,
        submenu: [
          { name: 'Products', href: '/inventory/products', feature: 'purchase_payments' },
          { name: 'Purchase & Payments', href: '/purchase-payments', feature: 'purchase_payments' },
          { name: 'Orders', href: '/inventory/orders', feature: 'purchase_payments' },
        ],
        feature: 'purchase_payments'
      },
      { name: 'Payroll', href: '/payroll', icon: CashIcon, feature: 'payroll' },
      { name: 'Lottery', href: '/lottery', icon: TicketIcon, feature: 'lottery' },
      { name: 'General Ledger', href: '/general-ledger', icon: BookIcon, feature: 'general_ledger' },
      { name: 'License Management', href: '/licenses', icon: DocumentIcon, feature: 'license_management' },
      { name: 'Reports & Analytics', href: '/reports', icon: ChartIcon, feature: 'reports' },
      { name: 'Settings', href: '/settings', icon: CogIcon },
    ];
    
    // Filter navigation items based on enabled features
    return allNavItems.filter(item => {
      if (!item.feature) return true; // Always show items without feature requirement
      return isFeatureEnabled(item.feature);
    });
  };

  const navigation = getNavigation();
  const currentPage = navigation.find((item) => location.pathname.startsWith(item.href)) || navigation[0];

  // Filter active stores for store selector
  const activeStores = stores.filter(s => s.is_active !== false && !s.deleted_at);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header Bar (Green like Hisably) */}
      <header className="bg-[#2d8659] text-white h-16 flex items-center justify-between px-6 shadow-md">
        {/* Left side: Logo and Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-[#256b49] rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <span className="text-[#2d8659] font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-lg hidden sm:inline">ETAIL</span>
          </div>
        </div>

        {/* Right side: Store Selector, Settings, User Menu */}
        <div className="flex items-center gap-4">
          {/* Store Selector (only for admin/manager with multiple stores) */}
          {hasMultipleStores && (user?.role === 'admin' || user?.role === 'manager') && (
            <div className="relative">
              <button
                onClick={() => setShowStoreMenu(!showStoreMenu)}
                className="flex items-center gap-2 px-3 py-2 bg-[#256b49] hover:bg-[#1e5638] rounded text-sm font-medium"
              >
                <span>{selectedStore?.name || 'Select Store'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showStoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowStoreMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
                    <div className="p-2">
                      {/* Multi Store Dashboard Option */}
                      <Link
                        to="/multi-store-dashboard"
                        onClick={() => setShowStoreMenu(false)}
                        className={`w-full text-left px-4 py-2 rounded text-sm hover:bg-gray-100 ${
                          location.pathname === '/multi-store-dashboard' ? 'bg-green-50 text-[#2d8659] font-medium' : 'text-gray-700'
                        }`}
                      >
                        <div className="font-medium flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Multi Store Dashboard
                        </div>
                        <div className="text-xs text-gray-500">View all stores</div>
                      </Link>
                      <div className="border-t my-2"></div>
                      {activeStores.map((store) => (
                        <button
                          key={store.id}
                          onClick={() => {
                            changeStore(store.id);
                            setShowStoreMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2 rounded text-sm hover:bg-gray-100 ${
                            selectedStore?.id === store.id ? 'bg-green-50 text-[#2d8659] font-medium' : 'text-gray-700'
                          }`}
                        >
                          <div className="font-medium">{store.name}</div>
                          {store.city && store.state && (
                            <div className="text-xs text-gray-500">{store.city}, {store.state}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Notifications Bell */}
          {(user?.role === 'admin' || user?.role === 'manager') && <NotificationBell />}

          {/* Settings Icon */}
          <Link to="/settings" className="p-2 hover:bg-[#256b49] rounded relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-[#256b49] rounded"
            >
              <span className="text-sm">Hi, {user?.first_name || 'User'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
                  <div className="p-2">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <div className="text-sm font-medium text-gray-900">{user?.first_name} {user?.last_name}</div>
                      <div className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar (Icon-based like Hisably) */}
        <aside
          className={`bg-white border-r border-gray-200 transition-all duration-300 ${
            showSidebar ? 'w-64' : 'w-20'
          } fixed h-[calc(100vh-4rem)] top-16 z-30`}
        >
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href) || (item.submenu && item.submenu.some(sub => location.pathname.startsWith(sub.href)));
              const isExpanded = expandedMenus[item.href] || false;
              const hasSubmenu = item.submenu && item.submenu.length > 0;
              
              // Filter submenu items based on features
              const visibleSubmenu = hasSubmenu ? item.submenu.filter(sub => {
                if (!sub.feature) return true;
                return isFeatureEnabled(sub.feature);
              }) : [];

              return (
                <div key={item.href}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                      isActive && !hasSubmenu
                        ? 'bg-[#e8f5e9] text-[#2d8659] border-l-4 border-[#2d8659]'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={!showSidebar ? item.name : ''}
                    onClick={() => {
                      if (hasSubmenu) {
                        setExpandedMenus(prev => ({ ...prev, [item.href]: !prev[item.href] }));
                      } else {
                        navigate(item.href);
                      }
                    }}
                  >
                    <span className="flex-shrink-0">{item.icon && <item.icon className="w-5 h-5" />}</span>
                    {showSidebar && (
                      <>
                        {hasSubmenu ? (
                          <span className="font-medium flex-1">{item.name}</span>
                        ) : (
                          <Link to={item.href} className="font-medium flex-1">
                            {item.name}
                          </Link>
                        )}
                      </>
                    )}
                    {showSidebar && hasSubmenu && (
                      <svg 
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                  {showSidebar && hasSubmenu && isExpanded && visibleSubmenu.length > 0 && (
                    <div className="ml-8 mt-1 space-y-1">
                      {visibleSubmenu.map((subItem) => {
                        const isSubActive = location.pathname.startsWith(subItem.href);
                        return (
                          <Link
                            key={subItem.href}
                            to={subItem.href}
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                              isSubActive
                                ? 'bg-[#e8f5e9] text-[#2d8659] font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-current"></span>
                            <span>{subItem.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${showSidebar ? 'ml-64' : 'ml-20'} min-w-0`}>
          <div className="p-6 max-w-full overflow-x-auto">{children}</div>
        </main>
      </div>

      {/* Footer (like Hisably) */}
      <footer className="bg-gray-800 text-white py-4 px-6 mt-auto">
        <div className="flex justify-between items-center text-sm">
          <div>
            Customer Support: <a href="tel:+16176831899" className="hover:underline">(617) 683-1899</a>
          </div>
          <div>
            © {new Date().getFullYear()} RetailCloudHQ. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
