-- Fix all contacts with NULL account_id
-- Set them to the active account that has email configurations

-- Get the account_id that has active email configurations
DO $$
DECLARE
  active_account_id UUID;
BEGIN
  -- Find the account with Outlook or Zoho config
  SELECT COALESCE(
    (SELECT account_id FROM outlook_config LIMIT 1),
    (SELECT account_id FROM zoho_config WHERE is_active = true LIMIT 1),
    (SELECT id FROM accounts ORDER BY created_at ASC LIMIT 1)
  ) INTO active_account_id;

  -- Update all contacts with NULL account_id
  UPDATE contacts 
  SET account_id = active_account_id
  WHERE account_id IS NULL;

  -- Update all campaigns with NULL account_id
  UPDATE campaigns 
  SET account_id = active_account_id
  WHERE account_id IS NULL;

  -- Update all email_threads with NULL account_id
  UPDATE email_threads 
  SET account_id = active_account_id
  WHERE account_id IS NULL;

  -- Update all email_messages with NULL account_id
  UPDATE email_messages 
  SET account_id = active_account_id
  WHERE account_id IS NULL;

  RAISE NOTICE 'Updated all NULL account_ids to: %', active_account_id;
END $$;
