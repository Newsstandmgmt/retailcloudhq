const { query } = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');

class SquareConnection {
    constructor(data) {
        Object.assign(this, data);
    }

    static sanitizeLocations(locations) {
        if (!locations) return [];
        if (Array.isArray(locations)) return locations;
        if (typeof locations === 'string') {
            try {
                return JSON.parse(locations);
            } catch (error) {
                return [];
            }
        }
        if (typeof locations === 'object') return [locations];
        return [];
    }

    static async upsert(storeId, connectionData) {
        const {
            account_id,
            merchant_id,
            location_id = null,
            available_locations = [],
            access_token,
            refresh_token,
            token_expires_at,
            scopes = [],
            created_by = null,
        } = connectionData;

        const encryptedAccessToken = access_token ? encrypt(access_token) : null;
        const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

        const result = await query(
            `INSERT INTO square_connections (
                store_id,
                account_id,
                merchant_id,
                location_id,
                available_locations,
                access_token,
                refresh_token,
                token_expires_at,
                scopes,
                created_by,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
            ON CONFLICT (store_id)
            DO UPDATE SET
                account_id = EXCLUDED.account_id,
                merchant_id = EXCLUDED.merchant_id,
                location_id = COALESCE(EXCLUDED.location_id, square_connections.location_id),
                available_locations = EXCLUDED.available_locations,
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                token_expires_at = EXCLUDED.token_expires_at,
                scopes = EXCLUDED.scopes,
                is_active = true,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId,
                account_id || null,
                merchant_id || null,
                location_id || null,
                JSON.stringify(available_locations || []),
                encryptedAccessToken,
                encryptedRefreshToken,
                token_expires_at || null,
                scopes,
                created_by,
            ]
        );

        return this.hydrate(result.rows[0]);
    }

    static hydrate(row) {
        if (!row) return null;
        const connection = new SquareConnection({
            ...row,
            available_locations: this.sanitizeLocations(row.available_locations),
        });
        if (connection.access_token) {
            connection.access_token = decrypt(connection.access_token);
        }
        if (connection.refresh_token) {
            connection.refresh_token = decrypt(connection.refresh_token);
        }
        return connection;
    }

    static hydrateArray(rows) {
        return rows.map(row => this.hydrate(row)).filter(Boolean);
    }

    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM square_connections WHERE store_id = $1',
            [storeId]
        );
        if (result.rows.length === 0) return null;
        return this.hydrate(result.rows[0]);
    }

    static async findActiveConnections() {
        const result = await query(
            'SELECT * FROM square_connections WHERE is_active = true'
        );
        if (result.rows.length === 0) return [];
        return this.hydrateArray(result.rows);
    }

    static async findById(id) {
        const result = await query(
            'SELECT * FROM square_connections WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) return null;
        return this.hydrate(result.rows[0]);
    }

    static async setLocation(storeId, locationId) {
        const result = await query(
            `UPDATE square_connections
             SET location_id = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $2
             RETURNING *`,
            [locationId, storeId]
        );
        if (result.rows.length === 0) return null;
        return this.hydrate(result.rows[0]);
    }

    static async updateTokens(storeId, { access_token, refresh_token, token_expires_at }) {
        const result = await query(
            `UPDATE square_connections
             SET access_token = $1,
                 refresh_token = $2,
                 token_expires_at = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $4
             RETURNING *`,
            [
                access_token ? encrypt(access_token) : null,
                refresh_token ? encrypt(refresh_token) : null,
                token_expires_at || null,
                storeId,
            ]
        );
        if (result.rows.length === 0) return null;
        return this.hydrate(result.rows[0]);
    }

    static async updateAvailableLocations(storeId, locations = []) {
        const result = await query(
            `UPDATE square_connections
             SET available_locations = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $2
             RETURNING *`,
            [JSON.stringify(locations || []), storeId]
        );
        if (result.rows.length === 0) return null;
        return this.hydrate(result.rows[0]);
    }

    static async markLastSynced(storeId) {
        await query(
            `UPDATE square_connections
             SET last_synced_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $1`,
            [storeId]
        );
    }

    static async deactivate(storeId) {
        const result = await query(
            `UPDATE square_connections
             SET is_active = false,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $1
             RETURNING *`,
            [storeId]
        );
        if (result.rows.length === 0) return null;
        return this.hydrate(result.rows[0]);
    }
}

module.exports = SquareConnection;

