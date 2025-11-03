-- Consolidate all account_ids to a single value for single-user mode
-- This fixes the issue where configs were saved with different account_ids

DO $$
DECLARE
  target_account_id UUID;
  outlook_count INT;
  zoho_count INT;
BEGIN
  -- Get the account_id from the most recent outlook_config or zoho_config
  SELECT COALESCE(
    (SELECT account_id FROM outlook_config ORDER BY updated_at DESC LIMIT 1),
    (SELECT user_account_id FROM zoho_config ORDER BY updated_at DESC LIMIT 1),
    '46be2333-937b-46de-9825-6cffe62565de'::UUID -- Fallback to the account_id from the logs
  ) INTO target_account_id;

  RAISE NOTICE 'Target account_id: %', target_account_id;

  -- Update all outlook_config records to use the target account_id
  UPDATE outlook_config SET account_id = target_account_id;
  GET DIAGNOSTICS outlook_count = ROW_COUNT;
  RAISE NOTICE 'Updated % outlook_config records', outlook_count;

  -- Update all zoho_config records to use the target account_id
  UPDATE zoho_config SET user_account_id = target_account_id;
  GET DIAGNOSTICS zoho_count = ROW_COUNT;
  RAISE NOTICE 'Updated % zoho_config records', zoho_count;

  -- Update all contacts to use the target account_id
  UPDATE contacts SET account_id = target_account_id WHERE account_id IS NOT NULL;
  RAISE NOTICE 'Updated contacts to use target account_id';

  -- Update all email_threads to use the target account_id
  UPDATE email_threads SET account_id = target_account_id WHERE account_id IS NOT NULL;
  RAISE NOTICE 'Updated email_threads to use target account_id';

  -- Update all email_messages to use the target account_id
  UPDATE email_messages SET account_id = target_account_id WHERE account_id IS NOT NULL;
  RAISE NOTICE 'Updated email_messages to use target account_id';

  -- Cast UUID to TEXT for replies table since account_id is TEXT type
  UPDATE replies SET account_id = target_account_id::TEXT WHERE account_id IS NOT NULL;
  RAISE NOTICE 'Updated replies to use target account_id';

  RAISE NOTICE 'Account consolidation complete!';
END $$;
