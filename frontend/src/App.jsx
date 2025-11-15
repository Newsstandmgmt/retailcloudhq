import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { StoreProvider } from './contexts/StoreContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stores from './pages/Stores';
import StoreForm from './pages/StoreForm';
import StoreDetail from './pages/StoreDetail';
import Revenue from './pages/Revenue';
import BusinessAnalytics from './pages/BusinessAnalytics';
import AdminManagement from './pages/AdminManagement';
import AdminDetail from './pages/AdminDetail';
import Billing from './pages/Billing';
import Statistics from './pages/Statistics';
import PurchasePayments from './pages/PurchasePayments';
import Payroll from './pages/Payroll';
import Settings from './pages/Settings';
import MultiStoreDashboard from './pages/MultiStoreDashboard';
import AuditLogs from './pages/AuditLogs';
import OperatingExpenses from './pages/OperatingExpenses';
import GeneralLedger from './pages/GeneralLedger';
import RecurringExpenses from './pages/RecurringExpenses';
import Reports from './pages/Reports';
import Subscriptions from './pages/Subscriptions';
import FeaturePricing from './pages/FeaturePricing';
import DataConfiguration from './pages/DataConfiguration';
import LicenseManagement from './pages/LicenseManagement';
import Products from './pages/Products';
import Orders from './pages/Orders';

// Lottery Management
import Lottery from './pages/Lottery';

const CashFlow = () => <div className="p-6"><h1 className="text-2xl font-bold">Cash Flow</h1><p className="text-gray-600">Coming soon...</p></div>;

function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stores"
            element={
              <ProtectedRoute>
                <Layout>
                  <Stores />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stores/new"
            element={
              <ProtectedRoute requiredRole={['super_admin', 'admin']}>
                <Layout>
                  <StoreForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stores/:id"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <StoreDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stores/:id/edit"
            element={
              <ProtectedRoute requiredRole={['super_admin', 'admin']}>
                <Layout>
                  <StoreForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/revenue"
            element={
              <ProtectedRoute>
                <Layout>
                  <Revenue />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/business-analytics"
            element={
              <ProtectedRoute requiredRole={['admin', 'manager']}>
                <Layout>
                  <BusinessAnalytics />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lottery"
            element={
              <ProtectedRoute>
                <Layout>
                  <Lottery />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashflow"
            element={
              <ProtectedRoute>
                <Layout>
                  <CashFlow />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/products"
            element={
              <ProtectedRoute>
                <Layout>
                  <Products />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/orders"
            element={
              <ProtectedRoute>
                <Layout>
                  <Orders />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-payments"
            element={
              <ProtectedRoute>
                <Layout>
                  <PurchasePayments />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <ProtectedRoute>
                <Layout>
                  <Payroll />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/utilities"
            element={
              <ProtectedRoute>
                <Layout>
                  <PurchasePayments />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/general-ledger"
            element={
              <ProtectedRoute requiredRole={['admin', 'manager', 'super_admin']}>
                <Layout>
                  <GeneralLedger />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <Layout>
                  <OperatingExpenses />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/licenses"
            element={
              <ProtectedRoute requiredRole={['admin', 'super_admin']}>
                <Layout>
                  <LicenseManagement />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-management"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <AdminManagement />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-management/:userId"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <AdminDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscriptions"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <Subscriptions />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <Billing />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/statistics"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <Statistics />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/feature-pricing"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <FeaturePricing />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/data-configuration"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <DataConfiguration />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredRole={['admin']}>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/multi-store-dashboard"
            element={
              <ProtectedRoute requiredRole={['admin', 'manager']}>
                <Layout>
                  <MultiStoreDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute requiredRole={['super_admin']}>
                <Layout>
                  <AuditLogs />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/recurring-expenses"
            element={
              <ProtectedRoute requiredRole={['admin', 'manager']}>
                <Layout>
                  <RecurringExpenses />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRole={['admin', 'manager']}>
                <Layout>
                  <Reports />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Router>
      </StoreProvider>
    </AuthProvider>
  );
}

export default App;
