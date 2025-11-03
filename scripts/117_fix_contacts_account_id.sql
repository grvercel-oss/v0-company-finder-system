-- Fix existing contacts with NULL account_id
-- This migration updates all contacts that don't have an account_id set

-- Update contacts with NULL account_id to use the first available account
-- This assumes single-user setup during development
UPDATE contacts 
SET account_id = (
  SELECT id 
  FROM accounts 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE account_id IS NULL;

-- Create composite index for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_account_campaign 
ON contacts(account_id, campaign_id);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_contacts_account_status 
ON contacts(account_id, status);
