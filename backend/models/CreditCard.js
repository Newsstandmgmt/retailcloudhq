const { query } = require('../config/database');

class CreditCard {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(cardData) {
        const { store_id, card_name, card_short_name, last_four_digits, created_by } = cardData;
        const result = await query(
            `INSERT INTO credit_cards (store_id, card_name, card_short_name, last_four_digits, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [store_id, card_name, card_short_name || null, last_four_digits || null, created_by || null]
        );
        return result.rows[0];
    }

    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM credit_cards WHERE store_id = $1 ORDER BY card_name',
            [storeId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM credit_cards WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async update(id, updateData) {
        const { card_name, card_short_name, last_four_digits } = updateData;
        const result = await query(
            `UPDATE credit_cards 
             SET card_name = COALESCE($1, card_name), 
                 card_short_name = COALESCE($2, card_short_name),
                 last_four_digits = COALESCE($3, last_four_digits),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [card_name, card_short_name, last_four_digits, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        const result = await query('DELETE FROM credit_cards WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }

    // Set default credit card (only one can be default per store)
    static async setDefault(storeId, cardId) {
        // First, unset all defaults for the store
        await query(
            `UPDATE credit_cards SET is_default = false WHERE store_id = $1`,
            [storeId]
        );

        // Then set this card as default
        const result = await query(
            `UPDATE credit_cards SET is_default = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
            [cardId]
        );
        return result.rows[0];
    }
}

module.exports = CreditCard;

