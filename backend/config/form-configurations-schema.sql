-- Form Configuration Schema
-- Allows super admin to define and customize data entry forms
-- Forms are dynamically rendered based on this configuration

-- Form templates (e.g., "Daily Revenue Entry", "Expense Entry", etc.)
CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE, -- e.g., "daily_revenue", "expense_entry"
    display_name VARCHAR(255) NOT NULL, -- e.g., "Daily Revenue Entry"
    description TEXT,
    form_type VARCHAR(50) NOT NULL, -- 'revenue', 'expense', 'lottery', 'invoice', etc.
    store_specific BOOLEAN DEFAULT false, -- Can each store have custom version?
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Form fields configuration
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- NULL for global, specific UUID for store-specific
    
    -- Field identification
    field_key VARCHAR(255) NOT NULL, -- Database column name or unique identifier
    field_label VARCHAR(255) NOT NULL, -- Display label
    field_type VARCHAR(50) NOT NULL, -- 'text', 'number', 'date', 'select', 'textarea', 'calculated'
    field_group VARCHAR(100), -- Group fields together (e.g., "Daily Cash", "Business Revenue", "Lottery")
    
    -- Field properties
    is_required BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,
    default_value TEXT,
    placeholder TEXT,
    help_text TEXT,
    
    -- For select/dropdown fields
    options JSONB, -- Array of {value, label} objects
    
    -- For calculated fields
    calculation_formula TEXT, -- Formula expression (e.g., "field1 + field2 - field3")
    depends_on_fields TEXT[], -- Array of field_keys this calculation depends on
    
    -- Validation
    validation_rules JSONB, -- {min, max, pattern, etc.}
    
    -- Display order
    display_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(form_template_id, store_id, field_key)
);

-- Calculated fields (derived values like "Total Net Sales")
CREATE TABLE IF NOT EXISTS calculated_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Field identification
    field_key VARCHAR(255) NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    field_group VARCHAR(100),
    
    -- Calculation
    calculation_formula TEXT NOT NULL, -- Formula expression
    input_fields TEXT[] NOT NULL, -- Which fields contribute to this calculation
    operation_type VARCHAR(50), -- 'sum', 'subtract', 'formula', etc.
    
    -- Display
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    format_type VARCHAR(50), -- 'currency', 'percentage', 'number', etc.
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(form_template_id, store_id, field_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_form_fields_template ON form_fields(form_template_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_store ON form_fields(store_id);
CREATE INDEX IF NOT EXISTS idx_calculated_fields_template ON calculated_fields(form_template_id);
CREATE INDEX IF NOT EXISTS idx_calculated_fields_store ON calculated_fields(store_id);

-- Triggers
CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON form_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_fields_updated_at BEFORE UPDATE ON form_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calculated_fields_updated_at BEFORE UPDATE ON calculated_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

