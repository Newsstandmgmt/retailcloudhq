const { query } = require('../config/database');

class JournalEntry {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create a new journal entry with lines
    static async create(storeId, entryData) {
        const {
            entry_date,
            entry_type = 'manual',
            description,
            reference_type,
            reference_id,
            status = 'draft',
            lines, // Array of { account_id, debit_amount, credit_amount, description }
            entered_by,
            notes
        } = entryData;

        // Validate that lines are provided and balanced
        if (!lines || lines.length < 2) {
            throw new Error('Journal entry must have at least 2 lines (double-entry)');
        }

        // Calculate totals
        const totalDebit = lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
        const totalCredit = lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);

        // Validate double-entry balance
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Journal entry is not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`);
        }

        // Validate each line has either debit or credit (not both, not neither)
        for (const line of lines) {
            const hasDebit = parseFloat(line.debit_amount || 0) > 0;
            const hasCredit = parseFloat(line.credit_amount || 0) > 0;
            if (hasDebit && hasCredit) {
                throw new Error('Each line must have either debit OR credit, not both');
            }
            if (!hasDebit && !hasCredit) {
                throw new Error('Each line must have either debit or credit amount');
            }
        }

        // Generate entry number
        const entryNumberResult = await query(
            'SELECT generate_journal_entry_number($1) as entry_number',
            [storeId]
        );
        const entryNumber = entryNumberResult.rows[0].entry_number;

        // Start transaction
        const { getClient } = require('../config/database');
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Insert journal entry
            const entryResult = await client.query(
                `INSERT INTO journal_entries (
                    store_id, entry_date, entry_number, entry_type, description,
                    reference_type, reference_id, status, total_debit, total_credit,
                    is_balanced, entered_by, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *`,
                [
                    storeId, entry_date, entryNumber, entry_type, description,
                    reference_type || null, reference_id || null, status,
                    totalDebit, totalCredit, true, entered_by || null, notes || null
                ]
            );

            const entry = entryResult.rows[0];

            // Insert journal entry lines
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                await client.query(
                    `INSERT INTO journal_entry_lines (
                        journal_entry_id, account_id, line_number,
                        debit_amount, credit_amount, description
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        entry.id,
                        line.account_id,
                        i + 1,
                        parseFloat(line.debit_amount || 0),
                        parseFloat(line.credit_amount || 0),
                        line.description || null
                    ]
                );
            }

            await client.query('COMMIT');
            return await this.findById(entry.id);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Post a journal entry (change status from draft to posted)
    static async post(entryId, postedBy) {
        const entry = await this.findById(entryId);
        if (!entry) {
            throw new Error('Journal entry not found');
        }

        if (entry.status === 'posted') {
            throw new Error('Journal entry is already posted');
        }

        if (!entry.is_balanced) {
            throw new Error('Cannot post an unbalanced journal entry');
        }

        const result = await query(
            `UPDATE journal_entries
             SET status = 'posted',
                 posted_by = $1,
                 posted_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [postedBy, entryId]
        );

        // Update account balances (this would be called after posting)
        // For now, we'll just return the updated entry
        return result.rows[0];
    }

    // Get journal entry by ID with lines
    static async findById(id) {
        const entryResult = await query(
            'SELECT * FROM journal_entries WHERE id = $1',
            [id]
        );

        if (entryResult.rows.length === 0) {
            return null;
        }

        const entry = entryResult.rows[0];

        // Get lines
        const linesResult = await query(
            `SELECT jel.*, coa.account_name, coa.account_code, coa.account_type
             FROM journal_entry_lines jel
             JOIN chart_of_accounts coa ON coa.id = jel.account_id
             WHERE jel.journal_entry_id = $1
             ORDER BY jel.line_number`,
            [id]
        );

        entry.lines = linesResult.rows;
        return entry;
    }

    // Get all journal entries for a store with filters
    static async findByStore(storeId, filters = {}) {
        let sql = `SELECT je.*, 
                   u1.first_name || ' ' || u1.last_name as entered_by_name,
                   u2.first_name || ' ' || u2.last_name as posted_by_name
                   FROM journal_entries je
                   LEFT JOIN users u1 ON u1.id = je.entered_by
                   LEFT JOIN users u2 ON u2.id = je.posted_by
                   WHERE je.store_id = $1`;
        
        const params = [storeId];
        let paramCount = 2;

        if (filters.start_date) {
            sql += ` AND je.entry_date >= $${paramCount}`;
            params.push(filters.start_date);
            paramCount++;
        }

        if (filters.end_date) {
            sql += ` AND je.entry_date <= $${paramCount}`;
            params.push(filters.end_date);
            paramCount++;
        }

        if (filters.status) {
            sql += ` AND je.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        if (filters.entry_type) {
            sql += ` AND je.entry_type = $${paramCount}`;
            params.push(filters.entry_type);
            paramCount++;
        }

        sql += ' ORDER BY je.entry_date DESC, je.created_at DESC';

        const result = await query(sql, params);
        return result.rows;
    }

    // Get account ledger (all transactions for a specific account)
    static async getAccountLedger(storeId, accountId, filters = {}) {
        let sql = `SELECT 
                   jel.id,
                   jel.debit_amount,
                   jel.credit_amount,
                   jel.description as line_description,
                   je.id as journal_entry_id,
                   je.entry_date,
                   je.entry_number,
                   je.entry_type,
                   je.description as entry_description,
                   je.reference_type,
                   je.reference_id,
                   je.status,
                   coa.account_name,
                   coa.account_code,
                   coa.account_type
                   FROM journal_entry_lines jel
                   JOIN journal_entries je ON je.id = jel.journal_entry_id
                   JOIN chart_of_accounts coa ON coa.id = jel.account_id
                   WHERE jel.account_id = $1 AND je.store_id = $2 AND je.status = 'posted'`;
        
        const params = [accountId, storeId];
        let paramCount = 3;

        if (filters.start_date) {
            sql += ` AND je.entry_date >= $${paramCount}`;
            params.push(filters.start_date);
            paramCount++;
        }

        if (filters.end_date) {
            sql += ` AND je.entry_date <= $${paramCount}`;
            params.push(filters.end_date);
            paramCount++;
        }

        sql += ' ORDER BY je.entry_date ASC, je.created_at ASC';

        const result = await query(sql, params);
        return result.rows;
    }

    // Calculate account balance for a specific account
    static async getAccountBalance(storeId, accountId, asOfDate = null) {
        const dateFilter = asOfDate ? `AND je.entry_date <= $3` : '';
        const params = asOfDate ? [accountId, storeId, asOfDate] : [accountId, storeId];

        const result = await query(
            `SELECT 
                COALESCE(SUM(jel.debit_amount), 0) as total_debit,
                COALESCE(SUM(jel.credit_amount), 0) as total_credit,
                COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0) as balance
             FROM journal_entry_lines jel
             JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE jel.account_id = $1 AND je.store_id = $2 AND je.status = 'posted' ${dateFilter}`,
            params
        );

        return result.rows[0];
    }

    // Get trial balance (all accounts with balances)
    static async getTrialBalance(storeId, asOfDate = null) {
        const dateFilter = asOfDate ? `AND je.entry_date <= $2` : '';
        const params = asOfDate ? [storeId, asOfDate] : [storeId];

        const result = await query(
            `SELECT 
                coa.id,
                coa.account_code,
                coa.account_name,
                coa.account_type,
                COALESCE(SUM(jel.debit_amount), 0) as total_debit,
                COALESCE(SUM(jel.credit_amount), 0) as total_credit,
                CASE 
                    WHEN coa.account_type IN ('asset', 'expense') THEN 
                        COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
                    ELSE 
                        COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
                END as balance
             FROM chart_of_accounts coa
             LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
             LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted' ${dateFilter}
             WHERE coa.store_id = $1 AND coa.is_active = true
             GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
             HAVING COALESCE(SUM(jel.debit_amount), 0) != 0 OR COALESCE(SUM(jel.credit_amount), 0) != 0
             ORDER BY coa.account_type, coa.account_code, coa.account_name`,
            params
        );

        return result.rows;
    }

    // Update journal entry (only if draft)
    static async update(id, updateData) {
        const entry = await this.findById(id);
        if (!entry) {
            throw new Error('Journal entry not found');
        }

        if (entry.status === 'posted') {
            throw new Error('Cannot update a posted journal entry');
        }

        // If lines are being updated, we need to delete old lines and insert new ones
        if (updateData.lines) {
            const { getClient } = require('../config/database');
            const client = await getClient();
            try {
                await client.query('BEGIN');

                // Delete old lines
                await client.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = $1', [id]);

                // Validate and calculate new totals
                const totalDebit = updateData.lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
                const totalCredit = updateData.lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);

                if (Math.abs(totalDebit - totalCredit) > 0.01) {
                    throw new Error('Journal entry is not balanced');
                }

                // Insert new lines
                for (let i = 0; i < updateData.lines.length; i++) {
                    const line = updateData.lines[i];
                    await client.query(
                        `INSERT INTO journal_entry_lines (
                            journal_entry_id, account_id, line_number,
                            debit_amount, credit_amount, description
                        )
                        VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            id,
                            line.account_id,
                            i + 1,
                            parseFloat(line.debit_amount || 0),
                            parseFloat(line.credit_amount || 0),
                            line.description || null
                        ]
                    );
                }

                // Update entry
                const allowedFields = ['entry_date', 'description', 'notes'];
                const updates = [];
                const values = [];
                let paramCount = 1;

                for (const field of allowedFields) {
                    if (updateData[field] !== undefined) {
                        updates.push(`${field} = $${paramCount}`);
                        values.push(updateData[field]);
                        paramCount++;
                    }
                }

                updates.push(`total_debit = $${paramCount}`);
                values.push(totalDebit);
                paramCount++;

                updates.push(`total_credit = $${paramCount}`);
                values.push(totalCredit);
                paramCount++;

                updates.push(`updated_at = CURRENT_TIMESTAMP`);

                values.push(id);
                await client.query(
                    `UPDATE journal_entries SET ${updates.join(', ')} WHERE id = $${paramCount}`,
                    values
                );

                await client.query('COMMIT');
                return await this.findById(id);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } else {
            // Just update entry fields
            const allowedFields = ['entry_date', 'description', 'notes'];
            const updates = [];
            const values = [];
            let paramCount = 1;

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    updates.push(`${field} = $${paramCount}`);
                    values.push(updateData[field]);
                    paramCount++;
                }
            }

            if (updates.length === 0) {
                throw new Error('No valid fields to update');
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            const result = await query(
                `UPDATE journal_entries SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
                values
            );

            return result.rows[0];
        }
    }

    // Delete journal entry (only if draft)
    static async delete(id) {
        const entry = await this.findById(id);
        if (!entry) {
            throw new Error('Journal entry not found');
        }

        if (entry.status === 'posted') {
            throw new Error('Cannot delete a posted journal entry');
        }

        // Lines will be deleted via CASCADE
        const result = await query('DELETE FROM journal_entries WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }

    // Reverse a posted journal entry
    static async reverse(entryId, reversedBy, reversalDate) {
        const entry = await this.findById(entryId);
        if (!entry) {
            throw new Error('Journal entry not found');
        }

        if (entry.status !== 'posted') {
            throw new Error('Can only reverse posted journal entries');
        }

        // Create reversal entry
        const reversalLines = entry.lines.map(line => ({
            account_id: line.account_id,
            debit_amount: line.credit_amount, // Swap debit/credit
            credit_amount: line.debit_amount,
            description: `Reversal of ${entry.entry_number}`
        }));

        const reversalEntry = await this.create(entry.store_id, {
            entry_date: reversalDate || new Date().toISOString().split('T')[0],
            entry_type: 'reversal',
            description: `Reversal of entry ${entry.entry_number}`,
            reference_type: 'journal_entry',
            reference_id: entry.id,
            status: 'posted', // Auto-post reversals
            lines: reversalLines,
            entered_by: reversedBy,
            notes: `Reversal of journal entry ${entry.entry_number}`
        });

        // Mark original entry as reversed
        await query(
            `UPDATE journal_entries SET status = 'reversed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [entryId]
        );

        return reversalEntry;
    }
}

module.exports = JournalEntry;

