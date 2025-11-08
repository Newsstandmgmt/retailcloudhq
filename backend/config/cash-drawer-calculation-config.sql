-- Cash Drawer Calculation Configuration
-- 
-- IMPORTANT: This configuration is for stores with COMBINED DRAWER only
-- (cash_drawer_type = 'combined' or 'same_drawer').
-- 
-- For stores with separate lottery and business drawers, separate accounting
-- will be implemented in a future update.
-- 
-- Allows super admin to configure how business sales are calculated based on drawer type

CREATE TABLE IF NOT EXISTS cash_drawer_calculation_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Configuration type: 'default' for system-wide, 'store' for store-specific
    config_type VARCHAR(20) DEFAULT 'default' CHECK (config_type IN ('default', 'store')),
    
    -- For combined drawers: formula to calculate business cash from total cash
    -- Total Business Cash Calculation:
    --   Total cash: PLUS
    --   Cash Adjustment: PLUS if positive, MINUS if negative
    --   Business credit card: PLUS
    --   CC transaction fee: MINUS
    --   Sales tax amount: NOTHING (ignored)
    --   Other cash expense: MINUS
    --   Online net: MINUS
    --   Total instant: MINUS
    --   Instant adjustment: MINUS if positive, ADD if negative
    --   Instant pay: PLUS
    --   Lottery credit card: PLUS
    combined_drawer_formula JSONB DEFAULT '{
        "formula": "total_cash + cash_adjustment + business_credit_card - credit_card_transaction_fees - other_cash_expense - online_net - total_instant - instant_adjustment + instant_pay + lottery_credit_card",
        "fields": {
            "total_cash": { "source": "revenue", "field": "total_cash", "required": true, "operation": "add" },
            "cash_adjustment": { "source": "revenue", "field": "cash_adjustment", "default": 0, "operation": "add_if_positive_subtract_if_negative" },
            "business_credit_card": { "source": "revenue", "field": "business_credit_card", "default": 0, "operation": "add" },
            "credit_card_transaction_fees": { "source": "revenue", "field": "credit_card_transaction_fees", "default": 0, "operation": "subtract" },
            "sales_tax_amount": { "source": "revenue", "field": "sales_tax_amount", "default": 0, "operation": "ignore" },
            "other_cash_expense": { "source": "revenue", "field": "other_cash_expense", "default": 0, "operation": "subtract" },
            "online_net": { "source": "revenue", "field": "online_net", "default": 0, "operation": "subtract" },
            "total_instant": { "source": "revenue", "field": "total_instant", "default": 0, "operation": "subtract" },
            "total_instant_adjustment": { "source": "revenue", "field": "total_instant_adjustment", "default": 0, "operation": "subtract_if_positive_add_if_negative" },
            "instant_pay": { "source": "revenue", "field": "instant_pay", "default": 0, "operation": "add" },
            "lottery_credit_card": { "source": "revenue", "field": "lottery_credit_card", "default": 0, "operation": "add" }
        },
        "description": "Total Business Cash = Total Cash + Cash Adjustment (signed) + Business Credit Card - CC Transaction Fees - Other Cash Expense - Online Net - Total Instant - Instant Adjustment (reversed) + Instant Pay + Lottery Credit Card"
    }'::jsonb,
    
    -- For combined drawers: formula to calculate daily lottery cash owed to lottery
    -- Daily Lottery Cash Owed Calculation:
    --   Online sales: NOTHING (ignored)
    --   Online net: PLUS
    --   Total instant: PLUS
    --   Instant pay: MINUS
    --   Instant adjustment: PLUS if positive, MINUS if negative
    --   Lottery credit card: MINUS
    lottery_owed_formula JSONB DEFAULT '{
        "formula": "online_net + total_instant - instant_pay + instant_adjustment - lottery_credit_card",
        "fields": {
            "online_sales": { "source": "revenue", "field": "online_sales", "default": 0, "operation": "ignore" },
            "online_net": { "source": "revenue", "field": "online_net", "default": 0, "operation": "add" },
            "total_instant": { "source": "revenue", "field": "total_instant", "default": 0, "operation": "add" },
            "instant_pay": { "source": "revenue", "field": "instant_pay", "default": 0, "operation": "subtract" },
            "total_instant_adjustment": { "source": "revenue", "field": "total_instant_adjustment", "default": 0, "operation": "add_if_positive_subtract_if_negative" },
            "lottery_credit_card": { "source": "revenue", "field": "lottery_credit_card", "default": 0, "operation": "subtract" }
        },
        "description": "Daily Lottery Cash Owed = Online Net + Total Instant - Instant Pay + Instant Adjustment (signed) - Lottery Credit Card"
    }'::jsonb,
    
    -- Field visibility configuration
    -- Which fields should be shown/required for business bookkeeping
    business_fields_config JSONB DEFAULT '[
        { "field": "total_cash", "label": "Total Cash", "required": true, "visible": true, "category": "cash" },
        { "field": "cash_adjustment", "label": "Cash Adjustment", "required": false, "visible": true, "category": "cash" },
        { "field": "business_credit_card", "label": "Business Credit Card", "required": false, "visible": true, "category": "credit_card" },
        { "field": "credit_card_transaction_fees", "label": "Transaction Fees", "required": false, "visible": true, "category": "credit_card" },
        { "field": "online_sales", "label": "Online Sales", "required": false, "visible": true, "category": "online" },
        { "field": "sales_tax_amount", "label": "Sales Tax", "required": false, "visible": true, "category": "tax" },
        { "field": "newspaper_sold", "label": "Newspaper Sales", "required": false, "visible": true, "category": "other" }
    ]'::jsonb,
    
    -- Field visibility for lottery bookkeeping
    lottery_fields_config JSONB DEFAULT '[
        { "field": "daily_draw_sales", "label": "Draw Sales", "required": false, "visible": true, "category": "draw" },
        { "field": "daily_draw_net", "label": "Draw Net", "required": false, "visible": true, "category": "draw" },
        { "field": "daily_instant_sales", "label": "Instant Sales", "required": false, "visible": true, "category": "instant" },
        { "field": "daily_instant_pay", "label": "Instant Pay", "required": false, "visible": true, "category": "instant" },
        { "field": "daily_instant_adjustment", "label": "Instant Adjustment", "required": false, "visible": true, "category": "instant" },
        { "field": "daily_lottery_card_transaction", "label": "Lottery Card Transaction", "required": false, "visible": true, "category": "card" }
    ]'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(store_id, config_type)
);

-- Default configuration (system-wide)
INSERT INTO cash_drawer_calculation_config (config_type, store_id)
VALUES ('default', NULL)
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_drawer_config_store ON cash_drawer_calculation_config(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_config_type ON cash_drawer_calculation_config(config_type);

-- Trigger for updated_at
CREATE TRIGGER update_cash_drawer_config_updated_at BEFORE UPDATE ON cash_drawer_calculation_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE cash_drawer_calculation_config IS 'Configuration for cash drawer calculations and field visibility for business and lottery bookkeeping';
COMMENT ON COLUMN cash_drawer_calculation_config.combined_drawer_formula IS 'Formula to calculate business cash when drawers are combined';
COMMENT ON COLUMN cash_drawer_calculation_config.business_fields_config IS 'Fields to display/require for business bookkeeping input';
COMMENT ON COLUMN cash_drawer_calculation_config.lottery_fields_config IS 'Fields to display/require for lottery bookkeeping input';

