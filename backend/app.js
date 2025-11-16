const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());

// Helper to sanitize origins coming from environment variables (Railway often auto-wraps with quotes)
const sanitizeOrigin = origin => origin.replace(/^['"]+|['"]+$/g, '').trim();

// CORS configuration - allow multiple origins in development
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(sanitizeOrigin).filter(Boolean)
    : [
        'http://localhost:5173',
        'http://localhost:3001',
        'http://localhost:5174',
        'https://retailcloudhq.netlify.app'
    ];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        // In production allow if wildcard
        if (allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        
        // In development, allow any localhost port
        if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route for testing
app.get('/', (req, res) => {
    res.json({ 
        message: '🏪 RetailCloudHQ API',
        status: 'Running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/device-auth', require('./routes/deviceAuth'));
app.use('/api/mobile', require('./routes/mobileApp'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/store-templates', require('./routes/storeTemplates'));
app.use('/api/feature-pricing', require('./routes/featurePricing'));
app.use('/api/base-subscription-pricing', require('./routes/baseSubscriptionPricing'));
app.use('/api/store-subscriptions', require('./routes/storeSubscriptions'));
app.use('/api/subscription-payments', require('./routes/subscriptionPayments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin-management', require('./routes/adminManagement'));
app.use('/api/revenue', require('./routes/revenue'));
app.use('/api/lottery', require('./routes/lottery'));
app.use('/api/lottery-advanced', require('./routes/lotteryAdvanced'));
app.use('/api/lottery-sales-data', require('./routes/lotterySalesData'));
app.use('/api/lottery-analytics', require('./routes/lotteryAnalytics'));
app.use('/api/lottery-email', require('./routes/lotteryEmail'));
app.use('/api/lottery-email-oauth', require('./routes/lotteryEmailOAuth'));
app.use('/api/lottery-daily-reports', require('./routes/lotteryDailyReports'));
app.use('/api/lottery-report-mappings', require('./routes/lotteryReportMappings'));
app.use('/api/state-lottery-configs', require('./routes/stateLotteryConfigs'));
app.use('/api/weekly-lottery', require('./routes/weeklyLottery'));
app.use('/api/cashflow', require('./routes/cashflow'));
app.use('/api/cogs', require('./routes/cogs'));
app.use('/api/utilities', require('./routes/utilities'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/licenses', require('./routes/licenses'));
app.use('/api/store-licenses', require('./routes/storeLicenses'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/data-configuration', require('./routes/dataConfiguration'));
app.use('/api/database-browser', require('./routes/databaseBrowser'));
app.use('/api/statistics', require('./routes/statistics'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/purchase-invoices', require('./routes/purchaseInvoices'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory-orders', require('./routes/inventoryOrders'));
app.use('/api/cross-store-payments', require('./routes/crossStorePayments'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/banks', require('./routes/banks'));
app.use('/api/credit-cards', require('./routes/creditCards'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/journal-entries', require('./routes/journalEntries'));
app.use('/api/recurring-expenses', require('./routes/recurringExpenses'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/cash-on-hand', require('./routes/cashOnHand'));
app.use('/api/cash-drawer-calculation', require('./routes/cashDrawerCalculation'));
app.use('/api/mobile-devices', require('./routes/mobileDevices'));
app.use('/api/mobile-logs', require('./routes/mobileLogs'));
app.use('/api/age-checks', require('./routes/ageChecks'));
app.use('/api/customer-tabs', require('./routes/customerTabs'));
app.use('/api/errors', require('./routes/errors'));
app.use('/api/square', require('./routes/square'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.path
    });
});

// Global error handler for backend errors
const logBackendError = async (error, context = {}) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const ERROR_LOG_FILE = path.join(__dirname, 'logs/errors.json');
    
    const errorReport = {
      timestamp: new Date().toISOString(),
      platform: 'backend',
      errorType: 'other',
      errorMessage: error.message || String(error),
      errorStack: error.stack,
      severity: error.status >= 500 ? 'high' : 'medium',
      context: {
        ...context,
        statusCode: error.status,
        path: context.path || context.url,
        method: context.method,
      },
    };
    
    // Try to append to error log file
    try {
      const logs = await fs.readFile(ERROR_LOG_FILE, 'utf8').then(JSON.parse).catch(() => []);
      logs.push(errorReport);
      // Keep only last 1000 errors
      const recentLogs = logs.slice(-1000);
      await fs.writeFile(ERROR_LOG_FILE, JSON.stringify(recentLogs, null, 2));
    } catch (fileError) {
      console.error('Failed to log error to file:', fileError);
    }
    
    console.error('\n🚨 BACKEND ERROR:');
    console.error('Message:', errorReport.errorMessage);
    console.error('Stack:', error.stack?.substring(0, 300));
    console.error('Context:', JSON.stringify(context, null, 2));
    console.error('---\n');
  } catch (logError) {
    console.error('Failed to log backend error:', logError);
  }
};

// Error handler
app.use(async (err, req, res, next) => {
    // Log backend error
    await logBackendError(err, {
      path: req.path,
      method: req.method,
      url: req.url,
      body: req.body,
      query: req.query,
    });
    
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

module.exports = app;