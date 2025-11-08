const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Directory for error logs
const ERROR_LOG_DIR = path.join(__dirname, '../logs');
const ERROR_LOG_FILE = path.join(ERROR_LOG_DIR, 'errors.json');

// Ensure logs directory exists
(async () => {
  try {
    await fs.mkdir(ERROR_LOG_DIR, { recursive: true });
    console.log('[ErrorRoutes] ✅ Error logs directory created:', ERROR_LOG_DIR);
  } catch (error) {
    console.error('[ErrorRoutes] Failed to create logs directory:', error);
  }
})();

// Helper to read error logs
async function readErrorLogs() {
  try {
    const data = await fs.readFile(ERROR_LOG_FILE, 'utf8');
    const logs = JSON.parse(data);
    console.log(`[ErrorRoutes] Read ${logs.length} error logs from file`);
    return logs;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, return empty array
      return [];
    }
    console.error('[ErrorRoutes] Error reading error logs:', error);
    return [];
  }
}

// Helper to write error logs
async function writeErrorLogs(logs) {
  try {
    // Keep only last 1000 errors to prevent file from growing too large
    const recentLogs = logs.slice(-1000);
    await fs.writeFile(ERROR_LOG_FILE, JSON.stringify(recentLogs, null, 2));
    console.log(`[ErrorRoutes] ✅ Wrote ${recentLogs.length} error logs to file`);
    return true;
  } catch (error) {
    console.error('[ErrorRoutes] Failed to write error logs:', error);
    return false;
  }
}

// Report error endpoint (for mobile app and frontend)
router.post('/report', async (req, res) => {
  try {
    const errorReport = req.body;
    
    console.log('[ErrorRoutes] 📨 Received error report:', {
      errorType: errorReport.errorType,
      severity: errorReport.severity,
      message: errorReport.errorMessage?.substring(0, 100),
      deviceId: errorReport.deviceId,
      platform: errorReport.platform,
    });
    
    // Validate required fields
    if (!errorReport.errorMessage || !errorReport.timestamp) {
      console.warn('[ErrorRoutes] ⚠️ Invalid error report - missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields: errorMessage, timestamp' 
      });
    }
    
    // Add server-side metadata
    errorReport.receivedAt = new Date().toISOString();
    errorReport.serverId = process.env.SERVER_ID || 'default';
    
    // Read existing logs
    const logs = await readErrorLogs();
    
    // Add new error
    logs.push(errorReport);
    
    // Write back
    await writeErrorLogs(logs);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('\n🚨 ERROR REPORT RECEIVED:');
      console.error('Type:', errorReport.errorType);
      console.error('Severity:', errorReport.severity);
      console.error('Message:', errorReport.errorMessage);
      console.error('Device:', errorReport.deviceModel, errorReport.osVersion);
      console.error('User:', errorReport.userId || 'Unknown');
      console.error('Stack:', errorReport.errorStack?.substring(0, 200) || 'No stack');
      console.error('---\n');
    }
    
    res.json({ 
      success: true, 
      message: 'Error reported successfully',
      errorId: errorReport.timestamp 
    });
  } catch (error) {
    console.error('[ErrorRoutes] Error processing error report:', error);
    res.status(500).json({ error: 'Failed to process error report' });
  }
});

// Get error logs (with filtering)
router.get('/logs', async (req, res) => {
  try {
    const { 
      limit = 100, 
      severity, 
      errorType, 
      deviceId, 
      userId,
      startDate,
      endDate 
    } = req.query;
    
    let logs = await readErrorLogs();
    
    // Filter by severity
    if (severity) {
      logs = logs.filter(log => log.severity === severity);
    }
    
    // Filter by error type
    if (errorType) {
      logs = logs.filter(log => log.errorType === errorType);
    }
    
    // Filter by device ID
    if (deviceId) {
      logs = logs.filter(log => log.deviceId === deviceId);
    }
    
    // Filter by user ID
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    
    // Filter by date range
    if (startDate) {
      logs = logs.filter(log => log.timestamp >= startDate);
    }
    if (endDate) {
      logs = logs.filter(log => log.timestamp <= endDate);
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit results
    const limitedLogs = logs.slice(0, parseInt(limit));
    
    // Get summary stats
    const stats = {
      total: logs.length,
      bySeverity: {
        critical: logs.filter(l => l.severity === 'critical').length,
        high: logs.filter(l => l.severity === 'high').length,
        medium: logs.filter(l => l.severity === 'medium').length,
        low: logs.filter(l => l.severity === 'low').length,
      },
      byType: {
        javascript: logs.filter(l => l.errorType === 'javascript').length,
        react: logs.filter(l => l.errorType === 'react').length,
        network: logs.filter(l => l.errorType === 'network').length,
        database: logs.filter(l => l.errorType === 'database').length,
        other: logs.filter(l => l.errorType === 'other').length,
      },
    };
    
    console.log(`[ErrorRoutes] 📊 Returning ${limitedLogs.length} of ${logs.length} total errors`);
    
    res.json({
      success: true,
      logs: limitedLogs,
      stats,
      total: logs.length,
      returned: limitedLogs.length,
    });
  } catch (error) {
    console.error('[ErrorRoutes] Error fetching error logs:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

// Get error stats
router.get('/stats', async (req, res) => {
  try {
    const logs = await readErrorLogs();
    
    const stats = {
      total: logs.length,
      last24Hours: logs.filter(l => {
        const logDate = new Date(l.timestamp);
        const now = new Date();
        return (now - logDate) < 24 * 60 * 60 * 1000;
      }).length,
      last7Days: logs.filter(l => {
        const logDate = new Date(l.timestamp);
        const now = new Date();
        return (now - logDate) < 7 * 24 * 60 * 60 * 1000;
      }).length,
      bySeverity: {
        critical: logs.filter(l => l.severity === 'critical').length,
        high: logs.filter(l => l.severity === 'high').length,
        medium: logs.filter(l => l.severity === 'medium').length,
        low: logs.filter(l => l.severity === 'low').length,
      },
      byType: {
        javascript: logs.filter(l => l.errorType === 'javascript').length,
        react: logs.filter(l => l.errorType === 'react').length,
        network: logs.filter(l => l.errorType === 'network').length,
        database: logs.filter(l => l.errorType === 'database').length,
        other: logs.filter(l => l.errorType === 'other').length,
      },
      uniqueDevices: new Set(logs.map(l => l.deviceId)).size,
      uniqueUsers: new Set(logs.map(l => l.userId).filter(Boolean)).size,
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[ErrorRoutes] Error fetching error stats:', error);
    res.status(500).json({ error: 'Failed to fetch error stats' });
  }
});

// Test endpoint to verify error reporting is working
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Error reporting API is working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      report: 'POST /api/errors/report',
      logs: 'GET /api/errors/logs',
      stats: 'GET /api/errors/stats',
    }
  });
});

// Clear error logs (admin only - add auth middleware in production)
router.delete('/logs', async (req, res) => {
  try {
    await fs.writeFile(ERROR_LOG_FILE, JSON.stringify([], null, 2));
    console.log('[ErrorRoutes] ✅ Error logs cleared');
    res.json({ success: true, message: 'Error logs cleared' });
  } catch (error) {
    console.error('[ErrorRoutes] Error clearing error logs:', error);
    res.status(500).json({ error: 'Failed to clear error logs' });
  }
});

// Remove resolved errors (filter out specific error patterns)
router.post('/resolve', async (req, res) => {
  try {
    const { errorPattern, errorType, severity, olderThan } = req.body;
    
    let logs = await readErrorLogs();
    const originalCount = logs.length;
    
    // Filter out resolved errors
    logs = logs.filter(log => {
      // Remove by error pattern (message contains)
      if (errorPattern && log.errorMessage?.includes(errorPattern)) {
        return false;
      }
      
      // Remove by error type
      if (errorType && log.errorType === errorType) {
        return false;
      }
      
      // Remove by severity
      if (severity && log.severity === severity) {
        return false;
      }
      
      // Remove errors older than specified time (in hours)
      if (olderThan) {
        const errorDate = new Date(log.timestamp);
        const cutoffDate = new Date(Date.now() - (olderThan * 60 * 60 * 1000));
        if (errorDate < cutoffDate) {
          return false;
        }
      }
      
      return true;
    });
    
    const removedCount = originalCount - logs.length;
    
    // Write back filtered logs
    await writeErrorLogs(logs);
    
    console.log(`[ErrorRoutes] ✅ Removed ${removedCount} resolved errors`);
    res.json({ 
      success: true, 
      message: `Removed ${removedCount} resolved errors`,
      removed: removedCount,
      remaining: logs.length
    });
  } catch (error) {
    console.error('[ErrorRoutes] Error resolving errors:', error);
    res.status(500).json({ error: 'Failed to resolve errors' });
  }
});

// Auto-cleanup: Remove old resolved errors (401 errors, etc.)
router.post('/cleanup', async (req, res) => {
  try {
    let logs = await readErrorLogs();
    const originalCount = logs.length;
    
    // Remove 401 errors (authentication errors - usually resolved after login)
    logs = logs.filter(log => {
      // Remove 401 errors that are older than 5 minutes (user should be logged in by then)
      if (log.errorMessage?.includes('401') || log.errorMessage?.includes('Unauthorized')) {
        const errorDate = new Date(log.timestamp);
        const fiveMinutesAgo = new Date(Date.now() - (5 * 60 * 1000));
        if (errorDate < fiveMinutesAgo) {
          return false; // Remove old 401 errors
        }
      }
      
      // Remove errors from "unknown-device" that are older than 10 minutes (device should be registered by then)
      if (log.deviceId === 'unknown-device') {
        const errorDate = new Date(log.timestamp);
        const tenMinutesAgo = new Date(Date.now() - (10 * 60 * 1000));
        if (errorDate < tenMinutesAgo) {
          return false;
        }
      }
      
      return true;
    });
    
    const removedCount = originalCount - logs.length;
    
    // Write back filtered logs
    await writeErrorLogs(logs);
    
    console.log(`[ErrorRoutes] ✅ Cleaned up ${removedCount} resolved errors`);
    res.json({ 
      success: true, 
      message: `Cleaned up ${removedCount} resolved errors`,
      removed: removedCount,
      remaining: logs.length
    });
  } catch (error) {
    console.error('[ErrorRoutes] Error cleaning up errors:', error);
    res.status(500).json({ error: 'Failed to cleanup errors' });
  }
});

module.exports = router;