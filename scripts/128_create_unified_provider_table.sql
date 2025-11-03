-- Create unified account_email_provider table
-- This replaces the separate outlook_config and zoho_config tables

CREATE TABLE IF NOT EXISTS account_email_provider (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('outlook', 'zoho')),
  settings JSONB NOT NULL,
  connected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Migrate Outlook configs first, using DISTINCT to avoid duplicates
INSERT INTO account_email_provider (account_id, provider, settings, connected_at, updated_at)
SELECT DISTINCT ON (account_id)
  account_id,
  'outlook' as provider,
  jsonb_build_object(
    'email', email,
    'access_token', access_token,
    'refresh_token', refresh_token,
    'expires_at', expires_at
  ) as settings,
  created_at as connected_at,
  updated_at
FROM outlook_config
WHERE account_id IS NOT NULL
ORDER BY account_id, updated_at DESC NULLS LAST
ON CONFLICT (account_id) DO NOTHING;

-- Migrate Zoho configs, using DISTINCT and preferring most recent
INSERT INTO account_email_provider (account_id, provider, settings, connected_at, updated_at)
SELECT DISTINCT ON (account_id)
  COALESCE(user_account_id, account_id) as account_id,
  'zoho' as provider,
  jsonb_build_object(
    'email', account_email,
    'access_token', access_token,
    'refresh_token', refresh_token,
    'token_expires_at', token_expires_at,
    'data_center', data_center,
    'account_name', account_name,
    'is_active', is_active
  ) as settings,
  created_at as connected_at,
  updated_at
FROM zoho_config
WHERE COALESCE(user_account_id, account_id) IS NOT NULL
ORDER BY COALESCE(user_account_id, account_id), updated_at DESC NULLS LAST
ON CONFLICT (account_id) DO UPDATE SET
  provider = EXCLUDED.provider,
  settings = EXCLUDED.settings,
  connected_at = EXCLUDED.connected_at,
  updated_at = EXCLUDED.updated_at;

-- Add NOT NULL constraints to email-related tables
-- First, ensure all records have a valid account_id (use default if null)
UPDATE contacts SET account_id = '00000000-0000-0000-0000-000000000000' WHERE account_id IS NULL;
UPDATE email_threads SET account_id = '00000000-0000-0000-0000-000000000000' WHERE account_id IS NULL;
UPDATE replies SET account_id = '00000000-0000-0000-0000-000000000000' WHERE account_id IS NULL;
UPDATE email_messages SET account_id = '00000000-0000-0000-0000-000000000000' WHERE account_id IS NULL;

-- Now add NOT NULL constraints
ALTER TABLE contacts ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE email_threads ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE replies ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE email_messages ALTER COLUMN account_id SET NOT NULL;

-- Enable RLS on the new table
ALTER TABLE account_email_provider ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY account_email_provider_policy ON account_email_provider
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true)::TEXT);

-- Drop old tables (only after successful migration)
DROP TABLE IF EXISTS outlook_config;
DROP TABLE IF EXISTS zoho_config;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_email_provider_account_id ON account_email_provider(account_id);
