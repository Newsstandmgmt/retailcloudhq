-- Journal Entries (General Ledger) Schema for RetailCloudHQ

-- ============================================
-- Chart of Accounts
-- ============================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    account_code VARCHAR(50),
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_of_accounts_store_code
    ON chart_of_accounts(store_id, account_code)
    WHERE account_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_store_name
    ON chart_of_accounts(store_id, account_name);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type
    ON chart_of_accounts(store_id, account_type);

DROP TRIGGER IF EXISTS update_chart_of_accounts_updated_at ON chart_of_accounts;
CREATE TRIGGER update_chart_of_accounts_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sequence tracker for journal entry numbers
CREATE TABLE IF NOT EXISTS journal_entry_sequences (
    store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    last_number BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_journal_entry_sequences_updated_at ON journal_entry_sequences;
CREATE TRIGGER update_journal_entry_sequences_updated_at
    BEFORE UPDATE ON journal_entry_sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate next journal entry number per store
CREATE OR REPLACE FUNCTION generate_journal_entry_number(p_store_id UUID)
RETURNS TEXT AS $$
DECLARE
    next_number BIGINT;
BEGIN
    LOOP
        -- Try to update existing sequence row
        UPDATE journal_entry_sequences
        SET last_number = last_number + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE store_id = p_store_id
        RETURNING last_number INTO next_number;

        IF FOUND THEN
            EXIT;
        END IF;

        -- Insert sequence row if it doesn't exist yet
        BEGIN
            INSERT INTO journal_entry_sequences (store_id, last_number)
            VALUES (p_store_id, 1)
            RETURNING last_number INTO next_number;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            -- Another transaction inserted concurrently, retry loop
        END;
    END LOOP;

    RETURN 'JE-' || to_char(next_number, 'FM000000');
END;
$$ LANGUAGE plpgsql;

-- Main journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    entry_number VARCHAR(50) NOT NULL,
    entry_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    description TEXT,
    reference_type VARCHAR(100),
    reference_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    total_debit NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(14, 2) NOT NULL DEFAULT 0,
    is_balanced BOOLEAN NOT NULL DEFAULT true,
    entered_by UUID REFERENCES users(id),
    posted_by UUID REFERENCES users(id),
    posted_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS reversed_from_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_store_number
    ON journal_entries(store_id, entry_number);

CREATE INDEX IF NOT EXISTS idx_journal_entries_store_date
    ON journal_entries(store_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_status
    ON journal_entries(status);

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Journal entry lines table
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    debit_amount NUMERIC(14, 2) DEFAULT 0,
    credit_amount NUMERIC(14, 2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry
    ON journal_entry_lines(journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account
    ON journal_entry_lines(account_id);

DROP TRIGGER IF EXISTS update_journal_entry_lines_updated_at ON journal_entry_lines;
CREATE TRIGGER update_journal_entry_lines_updated_at
    BEFORE UPDATE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


