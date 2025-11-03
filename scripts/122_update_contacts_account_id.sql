-- Fix contacts with NULL or mismatched account_id
-- This script updates all contacts to use the active account_id

DO $$
DECLARE
  active_account_id TEXT;
BEGIN
  -- Find the active account (one with outlook_config or zoho_config)
  SELECT COALESCE(
    (SELECT account_id FROM outlook_config LIMIT 1),
    (SELECT account_id FROM zoho_config WHERE is_active = true LIMIT 1),
    (SELECT id FROM accounts ORDER BY created_at DESC LIMIT 1)
  ) INTO active_account_id;

  -- Update all contacts to use this account_id
  UPDATE contacts 
  SET account_id = active_account_id
  WHERE account_id IS NULL OR account_id != active_account_id;

  RAISE NOTICE 'Updated contacts to use account_id: %', active_account_id;
END $$;
