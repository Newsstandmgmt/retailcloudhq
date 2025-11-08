const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

/**
 * Middleware to log user actions for audit trail
 */
const auditLogger = (options = {}) => {
    const {
        actionType,
        entityType,
        getEntityId = (req) => req.params.id || req.params.storeId || req.params.userId,
        getDescription = (req) => null,
        logRequestBody = false,
        logResponseBody = false,
        skipPaths = []
    } = options;

    return async (req, res, next) => {
        // Skip logging for certain paths
        if (skipPaths.some(path => req.path.includes(path))) {
            return next();
        }

        // Store original json method
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);

        // Capture request data
        const requestData = {
            body: logRequestBody ? req.body : null,
            query: req.query,
            params: req.params
        };

        // Override res.json to capture response (always capture for POST to get entity ID)
        res.json = function(data) {
            // Always capture response data so we can extract entity IDs from POST responses
            res.responseData = data;
            return originalJson(data);
        };

        res.send = function(data) {
            // Always capture response data so we can extract entity IDs from POST responses
            res.responseData = data;
            return originalSend(data);
        };

        // Log after response
        res.on('finish', async () => {
            try {
                // Only log if user is authenticated
                if (!req.user) {
                    // Skip logging for unauthenticated requests
                    return;
                }
                
                // Skip if this route doesn't have auditLogger configured
                if (!actionType && !entityType) {
                    // This middleware wasn't configured, skip logging
                    return;
                }

                const user = req.user;
                // Get entity ID from request or response (for POST operations, ID might be in response)
                let entityId = getEntityId(req);
                if (!entityId && req.method === 'POST' && res.responseData) {
                    // Try to get ID from response (common patterns: user.id, store.id, etc.)
                    // Handle both direct response and nested response objects
                    const responseData = res.responseData;
                    entityId = responseData.user?.id || responseData.store?.id || responseData.id || 
                               (responseData.data && (responseData.data.user?.id || responseData.data.store?.id || responseData.data.id)) || null;
                }
                const description = getDescription(req) || `${req.method} ${req.path}`;

                // Determine action type from HTTP method if not provided
                let finalActionType = actionType;
                if (!finalActionType) {
                    switch (req.method) {
                        case 'POST':
                            finalActionType = 'create';
                            break;
                        case 'PUT':
                        case 'PATCH':
                            finalActionType = 'update';
                            break;
                        case 'DELETE':
                            finalActionType = 'delete';
                            break;
                        case 'GET':
                            finalActionType = 'view';
                            break;
                        default:
                            finalActionType = req.method.toLowerCase();
                    }
                }

                // Get old values for updates/deletes
                let oldValues = null;
                if ((req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && entityId) {
                    // Try to fetch old values based on entity type
                    if (entityType === 'user' && entityId) {
                        const oldUser = await User.findById(entityId);
                        if (oldUser) {
                            oldValues = {
                                email: oldUser.email,
                                first_name: oldUser.first_name,
                                last_name: oldUser.last_name,
                                role: oldUser.role,
                                is_active: oldUser.is_active
                            };
                        }
                    }
                }

                // Get new values for creates/updates
                let newValues = null;
                if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                    newValues = logRequestBody ? requestData.body : null;
                }

                // Determine status
                const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failed';
                const errorMessage = status === 'failed' ? (res.responseData?.error || 'Request failed') : null;

                // Get IP address
                const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';

                // Get store ID from params or body
                const storeId = req.params.storeId || req.body.store_id || null;

                await AuditLog.create({
                    user_id: user.id,
                    user_email: user.email,
                    user_name: `${user.first_name} ${user.last_name}`,
                    action_type: finalActionType,
                    entity_type: entityType,
                    entity_id: entityId,
                    action_description: description,
                    resource_path: req.path,
                    http_method: req.method,
                    ip_address: ipAddress,
                    user_agent: req.headers['user-agent'],
                    old_values: oldValues,
                    new_values: newValues,
                    status: status,
                    error_message: errorMessage,
                    store_id: storeId,
                    metadata: {
                        status_code: res.statusCode,
                        response_time: Date.now() - req.startTime
                    }
                });
            } catch (error) {
                // Don't fail the request if logging fails, but log the error for debugging
                console.error('Error logging audit trail:', error);
                console.error('Request details:', {
                    path: req.path,
                    method: req.method,
                    user: req.user?.email,
                    actionType,
                    entityType,
                    hasResponseData: !!res.responseData
                });
                if (error.stack) {
                    console.error('Stack trace:', error.stack);
                }
            }
        });

        // Add start time for response time calculation
        req.startTime = Date.now();

        next();
    };
};

/**
 * Helper function to log login attempts
 */
const logLoginAttempt = async (email, success, ipAddress, userAgent, errorMessage = null, userId = null) => {
    try {
        const user = userId ? await User.findById(userId) : await User.findByEmail(email);
        
        await AuditLog.create({
            user_id: userId || (user?.id || null),
            user_email: email,
            user_name: user ? `${user.first_name} ${user.last_name}` : null,
            action_type: success ? 'login' : 'failed_login',
            action_description: success ? 'User logged in successfully' : `Failed login attempt: ${errorMessage || 'Invalid credentials'}`,
            resource_path: '/api/auth/login',
            http_method: 'POST',
            ip_address: ipAddress,
            user_agent: userAgent,
            status: success ? 'success' : 'failed',
            error_message: errorMessage
        });
    } catch (error) {
        console.error('Error logging login attempt:', error);
    }
};

/**
 * Helper function to log logout
 */
const logLogout = async (userId, email, userName, ipAddress, userAgent) => {
    try {
        await AuditLog.create({
            user_id: userId,
            user_email: email,
            user_name: userName,
            action_type: 'logout',
            action_description: 'User logged out',
            resource_path: '/api/auth/logout',
            http_method: 'POST',
            ip_address: ipAddress,
            user_agent: userAgent,
            status: 'success'
        });
    } catch (error) {
        console.error('Error logging logout:', error);
    }
};

/**
 * Helper function to manually log an action
 */
const logAction = async (data) => {
    try {
        await AuditLog.create(data);
    } catch (error) {
        console.error('Error logging action:', error);
    }
};

module.exports = {
    auditLogger,
    logLoginAttempt,
    logLogout,
    logAction
};

