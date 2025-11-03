-- Add provider field to outlook_config table
ALTER TABLE outlook_config 
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'outlook' CHECK (provider IN ('outlook', 'zoho'));

-- Add provider field to zoho_config table  
ALTER TABLE zoho_config 
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'zoho' CHECK (provider IN ('outlook', 'zoho'));

-- Update existing records to have the correct provider value
UPDATE outlook_config SET provider = 'outlook' WHERE provider IS NULL;
UPDATE zoho_config SET provider = 'zoho' WHERE provider IS NULL;

-- Create indexes for provider lookups
CREATE INDEX IF NOT EXISTS idx_outlook_config_provider ON outlook_config(provider);
CREATE INDEX IF NOT EXISTS idx_zoho_config_provider ON zoho_config(provider);

-- Add account_id to zoho_config if using different column name
-- (zoho_config uses account_id for Zoho's account ID, we need to track our user's account_id)
ALTER TABLE zoho_config 
ADD COLUMN IF NOT EXISTS user_account_id TEXT;

-- Create index for user_account_id lookups
CREATE INDEX IF NOT EXISTS idx_zoho_config_user_account_id ON zoho_config(user_account_id);
