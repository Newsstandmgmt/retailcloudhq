const { google } = require('googleapis');
const LotteryEmailService = require('./lotteryEmailService');
const LotteryEmailRule = require('../models/LotteryEmailRule');
const { query: dbQuery } = require('../config/database');

class GmailService {
    /**
     * Get Gmail OAuth2 client
     */
    static getOAuth2Client() {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

        if (!clientId || !clientSecret) {
            throw new Error('Google OAuth credentials not configured');
        }

        return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }

    /**
     * Generate OAuth2 authorization URL
     */
    static getAuthUrl(storeId) {
        const oauth2Client = this.getOAuth2Client();
        
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify'
        ];

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: JSON.stringify({ storeId }), // Store storeId in state for callback
            prompt: 'consent' // Force consent to get refresh token
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    static async getTokens(code) {
        const oauth2Client = this.getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    }

    /**
     * Get Gmail API client with access token
     */
    static async getGmailClient(accessToken, refreshToken) {
        const oauth2Client = this.getOAuth2Client();
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        // Refresh token if needed
        if (oauth2Client.isTokenExpiring()) {
            const { credentials } = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(credentials);
            return { client: google.gmail({ version: 'v1', auth: oauth2Client }), newTokens: credentials };
        }

        return { client: google.gmail({ version: 'v1', auth: oauth2Client }), newTokens: null };
    }

    /**
     * Check for new emails matching rules
     */
    static async checkEmails(emailAccountId) {
        const LotteryEmailAccount = require('../models/LotteryEmailAccount');
        const account = await LotteryEmailAccount.findById(emailAccountId);
        
        if (!account || !account.is_active) {
            throw new Error('Email account not found or inactive');
        }

        // Get Gmail client
        const { client, newTokens } = await this.getGmailClient(account.access_token, account.refresh_token);
        
        // Update tokens if refreshed
        if (newTokens) {
            await LotteryEmailAccount.update(emailAccountId, {
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token || account.refresh_token,
                token_expires_at: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
            });
        }

        // Get all active rules for this account
        const rules = await LotteryEmailRule.findByAccount(emailAccountId);
        const activeRules = rules.filter(r => r.is_active);

        const processedEmails = [];

        for (const rule of activeRules) {
            // Build Gmail query
            const searchQuery = this.buildGmailQuery(rule, account.email_address);
            
            // Search for emails
            const response = await client.users.messages.list({
                userId: 'me',
                q: searchQuery,
                maxResults: 10
            });

            const messages = response.data.messages || [];

            for (const message of messages) {
                try {
                    // Get full message
                    const fullMessage = await client.users.messages.get({
                        userId: 'me',
                        id: message.id,
                        format: 'full'
                    });

                    // Check if already processed
                    const existingLog = await dbQuery(
                        'SELECT * FROM lottery_email_logs WHERE email_id = $1 AND status = $2',
                        [message.id, 'success']
                    );

                    if (existingLog.rows.length > 0) {
                        continue; // Skip already processed
                    }

                    // Process the email
                    await this.processEmail(fullMessage.data, rule, account, message.id, client);
                    
                    processedEmails.push({
                        messageId: message.id,
                        ruleId: rule.id,
                        reportType: rule.report_type
                    });

                } catch (error) {
                    console.error(`Error processing email ${message.id}:`, error);
                    // Log error
                    await dbQuery(
                        `INSERT INTO lottery_email_logs (email_account_id, email_rule_id, email_id, email_subject, received_at, status, error_message)
                         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'error', $5)`,
                        [emailAccountId, rule.id, message.id, 'Unknown', error.message]
                    );
                }
            }
        }

        // Mark account as checked
        await LotteryEmailAccount.markChecked(emailAccountId);

        return processedEmails;
    }

    /**
     * Build Gmail search query from rule
     */
    static buildGmailQuery(rule, emailAddress) {
        // Use specific inbox if configured, otherwise use the connected account email
        const toAddress = rule.to_address || emailAddress;
        let query = `to:${toAddress}`;
        
        if (rule.sender_contains) {
            query += ` from:${rule.sender_contains}`;
        }
        
        if (rule.subject_contains) {
            query += ` subject:"${rule.subject_contains}"`;
        }

        // Only get unread emails (or all recent)
        query += ' is:unread';

        return query;
    }

    /**
     * Process a Gmail message
     */
    static async processEmail(message, rule, account, messageId, gmailClient) {
        const LotteryEmailService = require('./lotteryEmailService');
        
        // Extract email details
        const headers = message.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';

        // Find attachment (CSV file)
        const attachment = this.findCSVAttachment(message.payload);
        
        if (!attachment) {
            throw new Error('No CSV attachment found in email');
        }

        // Download attachment
        const csvContent = await this.downloadAttachment(gmailClient, messageId, attachment.attachmentId);

        const receivedAt = message.internalDate
            ? new Date(parseInt(message.internalDate, 10))
            : new Date();

        // Process based on report type
        let result;
        const metadata = {
            filename: attachment.filename || null,
            receivedAt,
        };

        if (rule.report_type === 'daily') {
            result = await LotteryEmailService.processDailySalesEmail(
                account.store_id,
                csvContent,
                messageId,
                subject,
                rule.retailer_number,
                metadata
            );
        } else if (rule.report_type === 'settlement') {
            result = await LotteryEmailService.processSettlementEmail(
                account.store_id,
                csvContent,
                messageId,
                subject,
                rule.retailer_number
            );
        } else if (rule.report_type === 'weekly') {
            // Weekly sales can use similar processing to daily
            // For now, we'll process it as daily sales
            result = await LotteryEmailService.processDailySalesEmail(
                account.store_id,
                csvContent,
                messageId,
                subject,
                rule.retailer_number,
                metadata
            );
        } else {
            throw new Error(`Report type ${rule.report_type} not yet implemented for email processing`);
        }

        // Log success
        await dbQuery(
            `INSERT INTO lottery_email_logs (email_account_id, email_rule_id, email_id, email_subject, email_from, received_at, processed_at, status, records_processed)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'success', 1)`,
            [account.id, rule.id, messageId, subject, from]
        );

        return result;
    }

    /**
     * Find CSV attachment in message
     */
    static findCSVAttachment(part) {
        if (part.filename && part.filename.endsWith('.csv')) {
            return { attachmentId: part.body.attachmentId, filename: part.filename };
        }

        if (part.parts) {
            for (const subPart of part.parts) {
                const found = this.findCSVAttachment(subPart);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * Download attachment from Gmail
     */
    static async downloadAttachment(client, messageId, attachmentId) {
        const response = await client.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: attachmentId
        });

        // Decode base64
        const data = response.data.data;
        const buffer = Buffer.from(data, 'base64');
        return buffer.toString('utf-8');
    }
}

module.exports = GmailService;

