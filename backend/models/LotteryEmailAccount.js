const { query } = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');

class LotteryEmailAccount {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(accountData) {
        const { store_id, provider = 'gmail', email_address, access_token, refresh_token, token_expires_at, is_active = true } = accountData;
        
        // Encrypt tokens before storing
        const encryptedAccessToken = access_token ? encrypt(access_token) : null;
        const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;
        
        const result = await query(
            `INSERT INTO lottery_email_accounts (store_id, provider, email_address, access_token, refresh_token, token_expires_at, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (store_id, email_address) DO UPDATE SET
                 provider = EXCLUDED.provider,
                 access_token = EXCLUDED.access_token,
                 refresh_token = EXCLUDED.refresh_token,
                 token_expires_at = EXCLUDED.token_expires_at,
                 is_active = EXCLUDED.is_active,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [store_id, provider, email_address, encryptedAccessToken, encryptedRefreshToken, token_expires_at, is_active]
        );
        return result.rows[0];
    }

    static async findByStore(storeId) {
        const result = await query(
            `SELECT id, store_id, provider, email_address, token_expires_at, is_active, last_checked_at, created_at, updated_at
             FROM lottery_email_accounts 
             WHERE store_id = $1 
             ORDER BY created_at DESC`,
            [storeId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query(
            'SELECT * FROM lottery_email_accounts WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) return null;
        
        const account = result.rows[0];
        // Decrypt tokens when retrieving
        if (account.access_token) {
            account.access_token = decrypt(account.access_token);
        }
        if (account.refresh_token) {
            account.refresh_token = decrypt(account.refresh_token);
        }
        return account;
    }

    static async findByEmail(emailAddress) {
        const result = await query(
            'SELECT * FROM lottery_email_accounts WHERE email_address = $1 AND is_active = true',
            [emailAddress]
        );
        if (result.rows.length === 0) return null;
        
        const account = result.rows[0];
        // Decrypt tokens
        if (account.access_token) {
            account.access_token = decrypt(account.access_token);
        }
        if (account.refresh_token) {
            account.refresh_token = decrypt(account.refresh_token);
        }
        return account;
    }

    static async update(id, updateData) {
        const { access_token, refresh_token, token_expires_at, is_active } = updateData;
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (access_token !== undefined) {
            const encryptedToken = access_token ? encrypt(access_token) : null;
            updates.push(`access_token = $${paramCount++}`);
            values.push(encryptedToken);
        }
        if (refresh_token !== undefined) {
            const encryptedToken = refresh_token ? encrypt(refresh_token) : null;
            updates.push(`refresh_token = $${paramCount++}`);
            values.push(encryptedToken);
        }
        if (token_expires_at !== undefined) {
            updates.push(`token_expires_at = $${paramCount++}`);
            values.push(token_expires_at);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return await this.findById(id);
        }

        values.push(id);
        const result = await query(
            `UPDATE lottery_email_accounts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    static async markChecked(id) {
        const result = await query(
            `UPDATE lottery_email_accounts 
             SET last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = LotteryEmailAccount;

