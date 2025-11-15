const app = require('./app');
require('dotenv').config();
const EmailMonitorCron = require('./services/emailMonitorCron');
const SquareSyncCron = require('./services/squareSyncCron');
const fs = require('fs').promises;
const path = require('path');

// Setup global error handlers for uncaught exceptions
const ERROR_LOG_FILE = path.join(__dirname, 'logs/errors.json');

// Ensure logs directory exists
(async () => {
  try {
    await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error);
  }
})();

// Log backend error to file
const logBackendError = async (error, context = {}) => {
  try {
    const errorReport = {
      timestamp: new Date().toISOString(),
      platform: 'backend',
      errorType: 'other',
      errorMessage: error.message || String(error),
      errorStack: error.stack,
      severity: 'critical',
      context: context,
    };
    
    try {
      const logs = await fs.readFile(ERROR_LOG_FILE, 'utf8').then(JSON.parse).catch(() => []);
      logs.push(errorReport);
      const recentLogs = logs.slice(-1000);
      await fs.writeFile(ERROR_LOG_FILE, JSON.stringify(recentLogs, null, 2));
    } catch (fileError) {
      console.error('Failed to log error to file:', fileError);
    }
    
    console.error('\n🚨 CRITICAL BACKEND ERROR:');
    console.error('Message:', errorReport.errorMessage);
    console.error('Stack:', error.stack?.substring(0, 500));
    console.error('---\n');
  } catch (logError) {
    console.error('Failed to log backend error:', logError);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await logBackendError(error, { type: 'uncaughtException' });
  // Don't exit in production - log and continue
  if (process.env.NODE_ENV === 'production') {
    console.error('Server continuing despite uncaught exception');
  } else {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  await logBackendError(error, { type: 'unhandledRejection', promise: String(promise) });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for mobile device access

app.listen(PORT, HOST, () => {
    console.log(`🚀 RetailCloudHQ server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${HOST === '0.0.0.0' ? 'YOUR_IP' : HOST}:${PORT}`);
    console.log(`📱 For Android Emulator: Use http://10.0.2.2:${PORT}`);
    console.log(`📱 For Physical Device: Use your computer's IP address (check with ifconfig/ipconfig)`);
    
    // Start email monitoring cron
    if (process.env.ENABLE_EMAIL_MONITOR !== 'false') {
        EmailMonitorCron.start();
    }

    if (process.env.ENABLE_SQUARE_SYNC_CRON !== 'false') {
        SquareSyncCron.start();
    }
});