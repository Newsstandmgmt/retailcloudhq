const express = require('express');
const SquareConnection = require('../models/SquareConnection');
const SquareDailySales = require('../models/SquareDailySales');
const DailyRevenue = require('../models/DailyRevenue');
const SquareService = require('../services/squareService');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

router.get('/oauth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.status(400).send('Missing code or state parameter.');
        }

        const statePayload = SquareService.validateState(state);
        const { storeId, userId } = statePayload;

        const tokenResponse = await SquareService.exchangeCodeForTokens(code);
        const accessToken = tokenResponse.access_token;
        const refreshToken = tokenResponse.refresh_token;
        const accountId = tokenResponse.account_id || null;
        const merchantId = tokenResponse.merchant_id || null;
        const expiresAt = tokenResponse.expires_at || null;

        const locations = await SquareService.listLocations(accessToken);

        let selectedLocation = null;
        if (locations.length === 1) {
            selectedLocation = locations[0].id;
        } else if (statePayload.locationHint) {
            const match = locations.find(loc => loc.id === statePayload.locationHint);
            if (match) {
                selectedLocation = match.id;
            }
        }

        await SquareConnection.upsert(storeId, {
            account_id: accountId,
            merchant_id: merchantId,
            location_id: selectedLocation,
            available_locations: locations,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expires_at: expiresAt,
            scopes: tokenResponse.scopes || [],
            created_by: userId || null,
        });

        res.send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 2rem;">
                    <h2>Square Connected</h2>
                    <p>You can close this window and return to RetailCloudHQ.</p>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Square OAuth callback error:', error);
        res.status(500).send(`Failed to connect Square: ${error.message}`);
    }
});

router.use(authenticate);

router.get('/connect-url', canAccessStore, authorize('admin', 'super_admin'), (req, res) => {
    try {
        const { storeId, locationId } = req.query;
        if (!storeId) {
            return res.status(400).json({ error: 'storeId is required' });
        }
        const url = SquareService.getOAuthUrl(storeId, req.user.id, locationId || null);
        res.json({ url });
    } catch (error) {
        console.error('Square connect URL error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/status/:storeId', canAccessStore, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const connection = await SquareConnection.findByStore(req.params.storeId);
        if (!connection) {
            return res.json({ connected: false });
        }
        const sanitized = { ...connection };
        delete sanitized.access_token;
        delete sanitized.refresh_token;
        res.json({ connected: true, connection: sanitized });
    } catch (error) {
        console.error('Square status error:', error);
        res.status(500).json({ error: 'Failed to load Square connection status' });
    }
});

router.post(
    '/location/:storeId',
    canAccessStore,
    authorize('admin', 'super_admin'),
    auditLogger({
        actionType: 'update',
        entityType: 'square_connection',
        getEntityId: (req) => req.params?.storeId || null,
        getDescription: (req) => `Updated Square location for store ${req.params?.storeId}`,
        logRequestBody: true,
    }),
    async (req, res) => {
        try {
            const { storeId } = req.params;
            const { location_id } = req.body;
            if (!location_id) {
                return res.status(400).json({ error: 'location_id is required' });
            }
            const connection = await SquareConnection.findByStore(storeId);
            if (!connection) {
                return res.status(404).json({ error: 'Square connection not found for this store' });
            }
            const locations = connection.available_locations || [];
            const exists = locations.some(loc => loc.id === location_id);
            if (!exists) {
                return res.status(400).json({ error: 'Location is not available for the connected Square account' });
            }
            const updated = await SquareConnection.setLocation(storeId, location_id);
            const sanitized = { ...updated };
            delete sanitized.access_token;
            delete sanitized.refresh_token;
            res.json({ message: 'Square location updated', connection: sanitized });
        } catch (error) {
            console.error('Square set location error:', error);
            res.status(500).json({ error: error.message || 'Failed to update location' });
        }
    }
);

router.post(
    '/disconnect/:storeId',
    canAccessStore,
    authorize('admin', 'super_admin'),
    auditLogger({
        actionType: 'update',
        entityType: 'square_connection',
        getEntityId: (req) => req.params?.storeId || null,
        getDescription: (req) => `Disconnected Square for store ${req.params?.storeId}`,
        logRequestBody: true,
    }),
    async (req, res) => {
        try {
            const { storeId } = req.params;
            await SquareConnection.deactivate(storeId);
            res.json({ message: 'Square disconnected for this store' });
        } catch (error) {
            console.error('Square disconnect error:', error);
            res.status(500).json({ error: error.message || 'Failed to disconnect Square' });
        }
    }
);

router.post(
    '/sync-daily-sales',
    canAccessStore,
    authorize('admin', 'super_admin'),
    auditLogger({
        actionType: 'update',
        entityType: 'square_daily_sales',
        getEntityId: (req) => req.body?.store_id || null,
        getDescription: (req) => {
            const date = req.body?.date;
            return `Synced Square daily sales for ${date || 'unknown date'}`;
        },
        logRequestBody: true,
    }),
    async (req, res) => {
        try {
            const { store_id, date } = req.body;
            if (!store_id || !date) {
                return res.status(400).json({ error: 'store_id and date are required' });
            }
            const totals = await SquareService.syncDailySales(store_id, date, { enteredBy: req.user.id });
            const dailyRevenue = await DailyRevenue.findByDate(store_id, date);
            const squareRecord = await SquareDailySales.findByStoreAndDate(store_id, date);
            res.json({
                message: 'Square sales synced successfully',
                totals,
                daily_revenue: dailyRevenue,
                square_daily_sales: squareRecord,
            });
        } catch (error) {
            console.error('Square sync daily sales error:', error);
            res.status(500).json({ error: error.message || 'Failed to sync Square sales' });
        }
    }
);

module.exports = router;

