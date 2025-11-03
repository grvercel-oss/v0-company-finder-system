-- Fix all contacts with NULL account_id
-- Set them to the account that has an active Outlook or Zoho config

DO $$
DECLARE
  active_account_id TEXT;
BEGIN
  -- Find the account with an active email config
  SELECT account_id INTO active_account_id
  FROM outlook_config
  WHERE account_id IS NOT NULL
  LIMIT 1;

  -- If no Outlook config, try Zoho
  IF active_account_id IS NULL THEN
    SELECT account_id INTO active_account_id
    FROM zoho_config
    WHERE account_id IS NOT NULL AND is_active = true
    LIMIT 1;
  END IF;

  -- If we found an active account, update all NULL account_ids
  IF active_account_id IS NOT NULL THEN
    RAISE NOTICE 'Using account_id: %', active_account_id;

    -- Update contacts
    UPDATE contacts
    SET account_id = active_account_id
    WHERE account_id IS NULL;

    RAISE NOTICE 'Updated % contacts', (SELECT COUNT(*) FROM contacts WHERE account_id = active_account_id);

    -- Update campaigns
    UPDATE campaigns
    SET account_id = active_account_id
    WHERE account_id IS NULL;

    -- Update email_threads
    UPDATE email_threads
    SET account_id = active_account_id
    WHERE account_id IS NULL;

    -- Update email_messages
    UPDATE email_messages
    SET account_id = active_account_id
    WHERE account_id IS NULL;

    RAISE NOTICE 'All NULL account_ids have been updated to: %', active_account_id;
  ELSE
    RAISE NOTICE 'No active account found - skipping update';
  END IF;
END $$;
