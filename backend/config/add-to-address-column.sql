-- Migration: Add to_address column to lottery_email_rules
-- This allows configuring specific inboxes to monitor (e.g., Gmail plus addressing)

ALTER TABLE lottery_email_rules 
    ADD COLUMN IF NOT EXISTS to_address VARCHAR(255);

COMMENT ON COLUMN lottery_email_rules.to_address IS 'Specific inbox to monitor (e.g., newsstandmgmt+1daily@gmail.com for Gmail plus addressing). If NULL, monitors all emails to the connected account.';

