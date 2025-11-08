-- Seed Daily Revenue Entry Form Template
-- This creates the default form template for Daily Revenue Entry that super admins can customize

-- Insert form template
INSERT INTO form_templates (name, display_name, description, form_type, store_specific, is_active)
VALUES (
    'daily_revenue',
    'Daily Revenue Entry',
    'Daily revenue entry form for admins and managers. Includes cash, credit card, lottery, and other revenue streams.',
    'revenue',
    true, -- Allow store-specific customization
    true
)
ON CONFLICT (name) DO NOTHING;

-- Get the template ID (for reference)
DO $$
DECLARE
    template_id_val UUID;
BEGIN
    SELECT id INTO template_id_val FROM form_templates WHERE name = 'daily_revenue';
    
    IF template_id_val IS NOT NULL THEN
        -- Insert Daily Cash fields
        INSERT INTO form_fields (form_template_id, store_id, field_key, field_label, field_type, field_group, is_required, is_visible, display_order)
        VALUES
            (template_id_val, NULL, 'total_cash', 'Total Cash', 'number', 'Daily Cash', false, true, 1),
            (template_id_val, NULL, 'cash_adjustment', 'Cash Adjustment', 'number', 'Daily Cash', false, true, 2)
        ON CONFLICT (form_template_id, store_id, field_key) 
        DO UPDATE SET
            field_label = EXCLUDED.field_label,
            field_type = EXCLUDED.field_type,
            field_group = EXCLUDED.field_group,
            is_required = EXCLUDED.is_required,
            is_visible = EXCLUDED.is_visible,
            display_order = EXCLUDED.display_order,
            updated_at = CURRENT_TIMESTAMP;
        
        -- Insert Business Revenue fields
        INSERT INTO form_fields (form_template_id, store_id, field_key, field_label, field_type, field_group, is_required, is_visible, display_order)
        VALUES
            (template_id_val, NULL, 'business_credit_card', 'Business Credit Card', 'number', 'Business Revenue', false, true, 10),
            (template_id_val, NULL, 'credit_card_transaction_fees', 'Credit Card Transaction Fees', 'number', 'Business Revenue', false, true, 11),
            (template_id_val, NULL, 'sales_tax_amount', 'Sales Tax Amount', 'number', 'Business Revenue', false, true, 12),
            (template_id_val, NULL, 'customer_tab', 'Customer Tab', 'number', 'Business Revenue', false, true, 13),
            (template_id_val, NULL, 'other_cash_expense', 'Other Cash Expense', 'number', 'Business Revenue', false, true, 14)
        ON CONFLICT (form_template_id, store_id, field_key) 
        DO UPDATE SET
            field_label = EXCLUDED.field_label,
            field_type = EXCLUDED.field_type,
            field_group = EXCLUDED.field_group,
            is_required = EXCLUDED.is_required,
            is_visible = EXCLUDED.is_visible,
            display_order = EXCLUDED.display_order,
            updated_at = CURRENT_TIMESTAMP;
        
        -- Insert Lottery fields
        INSERT INTO form_fields (form_template_id, store_id, field_key, field_label, field_type, field_group, is_required, is_visible, display_order)
        VALUES
            (template_id_val, NULL, 'online_sales', 'Online Sales', 'number', 'Lottery', false, true, 20),
            (template_id_val, NULL, 'online_net', 'Online Net', 'number', 'Lottery', false, true, 21),
            (template_id_val, NULL, 'total_instant', 'Total Instant', 'number', 'Lottery', false, true, 22),
            (template_id_val, NULL, 'total_instant_adjustment', 'Total Instant Adjustment', 'number', 'Lottery', false, true, 23),
            (template_id_val, NULL, 'instant_pay', 'Instant Pay', 'number', 'Lottery', false, true, 24),
            (template_id_val, NULL, 'lottery_credit_card', 'Lottery Credit Card', 'number', 'Lottery', false, true, 25)
        ON CONFLICT (form_template_id, store_id, field_key) 
        DO UPDATE SET
            field_label = EXCLUDED.field_label,
            field_type = EXCLUDED.field_type,
            field_group = EXCLUDED.field_group,
            is_required = EXCLUDED.is_required,
            is_visible = EXCLUDED.is_visible,
            display_order = EXCLUDED.display_order,
            updated_at = CURRENT_TIMESTAMP;
        
        -- Insert Newspaper fields (can be toggled via store settings)
        INSERT INTO form_fields (form_template_id, store_id, field_key, field_label, field_type, field_group, is_required, is_visible, display_order)
        VALUES
            (template_id_val, NULL, 'newspaper_sold', 'Newspaper Sold', 'number', 'Newspaper Sales', false, false, 30),
            (template_id_val, NULL, 'elias_newspaper', 'Elias Newspaper', 'number', 'Newspaper Sales', false, false, 31),
            (template_id_val, NULL, 'sam_newspaper', 'Sam Newspaper', 'number', 'Newspaper Sales', false, false, 32)
        ON CONFLICT (form_template_id, store_id, field_key) 
        DO UPDATE SET
            field_label = EXCLUDED.field_label,
            field_type = EXCLUDED.field_type,
            field_group = EXCLUDED.field_group,
            is_required = EXCLUDED.is_required,
            is_visible = EXCLUDED.is_visible,
            display_order = EXCLUDED.display_order,
            updated_at = CURRENT_TIMESTAMP;
        
        -- Insert Bank Deposit fields
        INSERT INTO form_fields (form_template_id, store_id, field_key, field_label, field_type, field_group, is_required, is_visible, display_order)
        VALUES
            (template_id_val, NULL, 'bank_deposit_amount', 'Bank Deposit Amount', 'number', 'Bank Deposits', false, true, 40),
            (template_id_val, NULL, 'bank_deposit_bank_id', 'Bank Deposit Bank ID', 'text', 'Bank Deposits', false, false, 41),
            (template_id_val, NULL, 'is_lottery_bank_deposit', 'Is Lottery Bank Deposit', 'text', 'Bank Deposits', false, false, 42)
        ON CONFLICT (form_template_id, store_id, field_key) 
        DO UPDATE SET
            field_label = EXCLUDED.field_label,
            field_type = EXCLUDED.field_type,
            field_group = EXCLUDED.field_group,
            is_required = EXCLUDED.is_required,
            is_visible = EXCLUDED.is_visible,
            display_order = EXCLUDED.display_order,
            updated_at = CURRENT_TIMESTAMP;
        
        -- Insert or update calculated fields for Daily Business Report
        INSERT INTO calculated_fields (form_template_id, store_id, field_key, field_label, field_group, calculation_formula, input_fields, operation_type, display_order, is_visible, format_type)
        VALUES
            -- Calculated Business Cash (from cash drawer calculation config)
            (
                template_id_val, 
                NULL, 
                'calculated_business_cash', 
                'Calculated Business Cash', 
                'Daily Business Report', 
                'total_cash + cash_adjustment + business_credit_card - credit_card_transaction_fees - other_cash_expense - online_net - total_instant - total_instant_adjustment + instant_pay + lottery_credit_card',
                ARRAY['total_cash', 'cash_adjustment', 'business_credit_card', 'credit_card_transaction_fees', 'other_cash_expense', 'online_net', 'total_instant', 'total_instant_adjustment', 'instant_pay', 'lottery_credit_card']::TEXT[],
                'formula',
                100,
                true,
                'currency'
            ),
            -- Calculated Lottery Owed (from cash drawer calculation config)
            (
                template_id_val, 
                NULL, 
                'calculated_lottery_owed', 
                'Calculated Lottery Owed', 
                'Daily Business Report', 
                'online_net + total_instant - instant_pay + total_instant_adjustment - lottery_credit_card',
                ARRAY['online_net', 'total_instant', 'instant_pay', 'total_instant_adjustment', 'lottery_credit_card']::TEXT[],
                'formula',
                101,
                true,
                'currency'
            ),
            -- Total Revenue (for Daily Business Report)
            -- Note: The actual formula in DailyBusinessReport component is:
            -- totalRevenue = totalCash + vendorPaymentsTotal + businessCreditCard + onlineSales + customerTab
            -- Where vendorPaymentsTotal comes from expenses API (filtered by '[Vendor Payment]' in notes)
            -- This formula shows the base revenue fields. Vendor payments are added by the component from expenses.
            (
                template_id_val, 
                NULL, 
                'total_revenue', 
                'Total Revenue', 
                'Daily Business Report', 
                'total_cash + business_credit_card + online_sales + customer_tab',
                ARRAY['total_cash', 'business_credit_card', 'online_sales', 'customer_tab']::TEXT[],
                'formula',
                102,
                true,
                'currency'
            ),
            -- Net Sales (for Daily Business Report)
            -- Note: Actual calculation in DailyBusinessReport component is:
            -- netSales = totalRevenue - otherCashExpenses
            -- Where otherCashExpenses = totalExpenses - vendorPaymentsTotal (from expenses API)
            -- This formula references other_cash_expense field, but the actual calculation
            -- is done in the component using expenses API data
            (
                template_id_val, 
                NULL, 
                'net_sales', 
                'Net Sales', 
                'Daily Business Report', 
                'total_revenue - other_cash_expense',
                ARRAY['total_revenue', 'other_cash_expense']::TEXT[],
                'formula',
                103,
                true,
                'currency'
            ),
            -- Lottery Due After Deposit (for Daily Business Report)
            (
                template_id_val, 
                NULL, 
                'lottery_due_after_deposit', 
                'Lottery Due After Deposit', 
                'Daily Business Report', 
                'calculated_lottery_owed - bank_deposit_amount',
                ARRAY['calculated_lottery_owed', 'bank_deposit_amount']::TEXT[],
                'formula',
                104,
                true,
                'currency'
            )
        ON CONFLICT (form_template_id, store_id, field_key) 
        DO UPDATE SET
            field_label = EXCLUDED.field_label,
            field_group = EXCLUDED.field_group,
            calculation_formula = EXCLUDED.calculation_formula,
            input_fields = EXCLUDED.input_fields,
            operation_type = EXCLUDED.operation_type,
            display_order = EXCLUDED.display_order,
            is_visible = EXCLUDED.is_visible,
            format_type = EXCLUDED.format_type,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
END $$;

