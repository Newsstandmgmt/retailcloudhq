const express = require('express');
const LotteryEmailAccount = require('../models/LotteryEmailAccount');
const LotteryEmailRule = require('../models/LotteryEmailRule');
const GmailService = require('../services/gmailService');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');

const router = express.Router();

// OAuth callback (no auth required - this is called by Google)
// MUST be before router.use(authenticate)
router.get('/gmail/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        console.log('Gmail OAuth callback received:', { hasCode: !!code, hasState: !!state });
        
        // Get frontend URL helper
        const getFrontendUrl = () => {
            let url = process.env.CORS_ORIGIN || process.env.FRONTEND_URL;
            if (url && url.includes(',')) {
                url = url.split(',')[0].trim();
            }
            return url || 'http://localhost:5173';
        };

        if (!code) {
            return res.redirect(`${getFrontendUrl()}/lottery?error=no_code`);
        }

        // Parse state to get storeId
        let storeId;
        try {
            const stateData = JSON.parse(state);
            storeId = stateData.storeId;
            console.log('Parsed storeId from state:', storeId);
        } catch (e) {
            console.error('Error parsing state:', e);
            return res.redirect(`${getFrontendUrl()}/lottery?error=invalid_state`);
        }

        // Exchange code for tokens
        console.log('Exchanging code for tokens...');
        const tokens = await GmailService.getTokens(code);
        console.log('Tokens received, getting user profile...');

        // Get user email from Gmail API
        const { client } = await GmailService.getGmailClient(tokens.access_token, tokens.refresh_token);
        const profile = await client.users.getProfile({ userId: 'me' });
        const emailAddress = profile.data.emailAddress;
        console.log('Gmail email address:', emailAddress);

        // Create or update email account
        const account = await LotteryEmailAccount.create({
            store_id: storeId,
            provider: 'gmail',
            email_address: emailAddress,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            is_active: true
        });
        console.log('Email account created:', account.id);

        // Redirect to frontend with success message
        const frontendUrl = getFrontendUrl();
        const successUrl = `${frontendUrl}/lottery?emailConnected=true&accountId=${account.id}`;
        console.log('Redirecting to frontend:', successUrl);
        res.redirect(successUrl);
    } catch (error) {
        console.error('Gmail OAuth callback error:', error);
        console.error('Error stack:', error.stack);
        const frontendUrl = getFrontendUrl();
        const errorUrl = `${frontendUrl}/lottery?error=connection_failed&message=${encodeURIComponent(error.message)}`;
        res.redirect(errorUrl);
    }
});

// Now apply authentication middleware to all other routes
router.use(authenticate);

const sendAuthUrl = async (req, res) => {
    try {
        console.log('Getting Gmail auth URL for store:', req.params.storeId);
        console.log('Environment check:', {
            hasClientId: !!process.env.GOOGLE_CLIENT_ID,
            hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
            redirectUri: process.env.GOOGLE_REDIRECT_URI
        });
        
        const authUrl = GmailService.getAuthUrl(req.params.storeId);
        console.log('Generated auth URL successfully');
        res.json({ authUrl });
    } catch (error) {
        console.error('Get Gmail auth URL error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to generate auth URL', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Legacy endpoint kept for compatibility
router.get('/stores/:storeId/gmail/connect', canAccessStore, authorize('super_admin', 'admin'), sendAuthUrl);

// Preferred endpoint used by the frontend service layer
router.get('/stores/:storeId/auth-url', canAccessStore, authorize('super_admin', 'admin'), sendAuthUrl);

// Get email accounts for a store
router.get('/stores/:storeId/accounts', canAccessStore, async (req, res) => {
    try {
        console.log('Getting email accounts for store:', req.params.storeId);
        const accounts = await LotteryEmailAccount.findByStore(req.params.storeId);
        
        // Get rules for each account
        const accountsWithRules = await Promise.all(
            accounts.map(async (account) => {
                const rules = await LotteryEmailRule.findByAccount(account.id);
                return { ...account, rules };
            })
        );

        res.json({ accounts: accountsWithRules });
    } catch (error) {
        console.error('Get email accounts error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch email accounts', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Create email rule
router.post('/accounts/:accountId/rules', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { query } = require('../config/database');
        
        // Get email account to check store access
        const account = await LotteryEmailAccount.findById(req.params.accountId);
        if (!account) {
            return res.status(404).json({ error: 'Email account not found' });
        }

        // Check store access manually
        const storeId = account.store_id;
        const userId = req.user.id;
        
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [userId, storeId]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            // Also check if store exists
            const storeCheck = await query('SELECT id FROM stores WHERE id = $1', [storeId]);
            if (storeCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Store not found.' });
            }
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const { report_type, to_address, subject_contains, sender_contains, retailer_number, label_id, label_name } = req.body;
        
        if (!report_type) {
            return res.status(400).json({ error: 'report_type is required' });
        }

        try {
            const rule = await LotteryEmailRule.create({
                email_account_id: req.params.accountId,
                report_type,
                to_address: to_address || null,
                subject_contains: subject_contains || null,
                sender_contains: sender_contains || 'palottery.com',
                retailer_number: retailer_number || null,
                label_id: label_id || null,
                label_name: label_name || null
            });

            res.json({ message: 'Email rule created successfully', rule });
        } catch (dbError) {
            console.error('Database error creating rule:', dbError);
            console.error('Error message:', dbError.message);
            console.error('Error code:', dbError.code);
            
            // If column doesn't exist, try to add it
            const errorMessage = dbError.message || '';
            const errorCode = dbError.code || '';
            
            // PostgreSQL error codes: 42703 = undefined column, 42883 = undefined function
            if (errorMessage.includes('to_address') || 
                (errorMessage.includes('column') && errorMessage.includes('does not exist')) ||
                errorCode === '42703') {
                console.log('to_address column not found, attempting to add it...');
                try {
                    // Try to add the column
                    await query('ALTER TABLE lottery_email_rules ADD COLUMN IF NOT EXISTS to_address VARCHAR(255)');
                    console.log('to_address column added successfully, retrying insert...');
                    // Retry the insert
                    const rule = await LotteryEmailRule.create({
                        email_account_id: req.params.accountId,
                        report_type,
                        to_address: to_address || null,
                        subject_contains: subject_contains || null,
                        sender_contains: sender_contains || 'palottery.com',
                        retailer_number: retailer_number || null
                    });
                    res.json({ message: 'Email rule created successfully', rule });
                    return;
                } catch (retryError) {
                    console.error('Retry error after adding column:', retryError);
                    throw retryError;
                }
            } else {
                throw dbError;
            }
        }
    } catch (error) {
        console.error('Create email rule error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to create email rule', 
            details: error.message,
            hint: error.message && error.message.includes('to_address') 
                ? 'The to_address column may need to be added to the database. Run: ALTER TABLE lottery_email_rules ADD COLUMN IF NOT EXISTS to_address VARCHAR(255);'
                : undefined
        });
    }
});

// Update email rule
router.put('/rules/:id', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { query } = require('../config/database');
        
        // Get rule to check store access
        const existingRule = await LotteryEmailRule.findById(req.params.id);
        if (!existingRule) {
            return res.status(404).json({ error: 'Email rule not found' });
        }

        // Get email account to check store access
        const account = await LotteryEmailAccount.findById(existingRule.email_account_id);
        if (!account) {
            return res.status(404).json({ error: 'Email account not found' });
        }

        // Check store access manually
        const storeId = account.store_id;
        const userId = req.user.id;
        
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [userId, storeId]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            const storeCheck = await query('SELECT id FROM stores WHERE id = $1', [storeId]);
            if (storeCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Store not found.' });
            }
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const rule = await LotteryEmailRule.update(req.params.id, req.body);
        if (!rule) {
            return res.status(404).json({ error: 'Email rule not found' });
        }
        res.json({ message: 'Email rule updated successfully', rule });
    } catch (error) {
        console.error('Update email rule error:', error);
        res.status(500).json({ error: 'Failed to update email rule', details: error.message });
    }
});

// Delete email rule
router.delete('/rules/:id', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { query } = require('../config/database');
        
        // Get rule to check store access
        const existingRule = await LotteryEmailRule.findById(req.params.id);
        if (!existingRule) {
            return res.status(404).json({ error: 'Email rule not found' });
        }

        // Get email account to check store access
        const account = await LotteryEmailAccount.findById(existingRule.email_account_id);
        if (!account) {
            return res.status(404).json({ error: 'Email account not found' });
        }

        // Check store access manually
        const storeId = account.store_id;
        const userId = req.user.id;
        
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [userId, storeId]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            const storeCheck = await query('SELECT id FROM stores WHERE id = $1', [storeId]);
            if (storeCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Store not found.' });
            }
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const rule = await LotteryEmailRule.delete(req.params.id);
        if (!rule) {
            return res.status(404).json({ error: 'Email rule not found' });
        }
        res.json({ message: 'Email rule deleted successfully' });
    } catch (error) {
        console.error('Delete email rule error:', error);
        res.status(500).json({ error: 'Failed to delete email rule', details: error.message });
    }
});

// Manually check emails for an account
const handleManualCheck = async (req, res) => {
    try {
        const { query } = require('../config/database');
        
        // Get email account to check store access
        const account = await LotteryEmailAccount.findById(req.params.accountId);
        if (!account) {
            return res.status(404).json({ error: 'Email account not found' });
        }

        // Check store access manually
        const storeId = account.store_id;
        const userId = req.user.id;
        
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [userId, storeId]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            const storeCheck = await query('SELECT id FROM stores WHERE id = $1', [storeId]);
            if (storeCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Store not found.' });
            }
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const processedEmails = await GmailService.checkEmails(req.params.accountId);
        res.json({ 
            message: 'Email check completed', 
            processedCount: processedEmails.length,
            processedEmails 
        });
    } catch (error) {
        console.error('Check emails error:', error);
        res.status(500).json({ error: 'Failed to check emails', details: error.message });
    }
};

// Legacy endpoint
router.post('/accounts/:accountId/check', authorize('super_admin', 'admin'), handleManualCheck);

// Preferred endpoint used by frontend
router.post('/accounts/:accountId/check-emails', authorize('super_admin', 'admin'), handleManualCheck);

router.get('/accounts/:accountId/labels', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { query } = require('../config/database');
        const LotteryEmailAccount = require('../models/LotteryEmailAccount');

        const account = await LotteryEmailAccount.findById(req.params.accountId);
        if (!account) {
            return res.status(404).json({ error: 'Email account not found' });
        }

        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, account.store_id]
        );

        if (accessResult.rows[0]?.can_access !== true) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const labels = await GmailService.listLabels(req.params.accountId);
        res.json({ labels });
    } catch (error) {
        console.error('Get Gmail labels error:', error);
        res.status(500).json({ error: 'Failed to fetch Gmail labels', details: error.message });
    }
});

const disconnectAccount = async (req, res) => {
    try {
        const { query } = require('../config/database');
        
        // Get email account to check store access
        const account = await LotteryEmailAccount.findById(req.params.id || req.params.accountId);
        if (!account) {
            return res.status(404).json({ error: 'Email account not found' });
        }

        // Check store access manually
        const storeId = account.store_id;
        const userId = req.user.id;
        
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [userId, storeId]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            const storeCheck = await query('SELECT id FROM stores WHERE id = $1', [storeId]);
            if (storeCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Store not found.' });
            }
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        // Delete all rules first
        await query('DELETE FROM lottery_email_rules WHERE email_account_id = $1', [account.id]);
        
        // Delete the account
        await query('DELETE FROM lottery_email_accounts WHERE id = $1', [account.id]);
        
        res.json({ message: 'Email account disconnected successfully' });
    } catch (error) {
        console.error('Disconnect email account error:', error);
        res.status(500).json({ error: 'Failed to disconnect email account', details: error.message });
    }
};

// Disconnect email account
router.delete('/accounts/:id', authorize('super_admin', 'admin'), disconnectAccount);
router.post('/accounts/:accountId/disconnect', authorize('super_admin', 'admin'), disconnectAccount);

module.exports = router;

