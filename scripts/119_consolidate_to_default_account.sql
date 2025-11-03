-- Consolidate all email service configurations to use the default account ID
-- This ensures production and v0 preview use the same account_id

DO $$
DECLARE
  default_account_id TEXT := '00000000-0000-0000-0000-000000000000';
  existing_account_id TEXT;
BEGIN
  -- Get the first existing account_id from outlook_config
  SELECT account_id INTO existing_account_id
  FROM outlook_config
  WHERE account_id IS NOT NULL
  LIMIT 1;

  -- If we found an existing account_id, update all tables to use default_account_id
  IF existing_account_id IS NOT NULL THEN
    RAISE NOTICE 'Consolidating account_id % to default %', existing_account_id, default_account_id;

    -- Update outlook_config
    UPDATE outlook_config
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update zoho_config
    UPDATE zoho_config
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update gmail_accounts
    UPDATE gmail_accounts
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update contacts
    UPDATE contacts
    SET account_id = default_account_id
    WHERE account_id = existing_account_id OR account_id IS NULL;

    -- Update campaigns
    UPDATE campaigns
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update company_lists
    UPDATE company_lists
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update email_threads
    UPDATE email_threads
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update email_messages
    UPDATE email_messages
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update email_events
    UPDATE email_events
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update ai_usage_tracking
    UPDATE ai_usage_tracking
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update outreach_campaigns
    UPDATE outreach_campaigns
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update outreach_contacts
    UPDATE outreach_contacts
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update replies
    UPDATE replies
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update user_profile
    UPDATE user_profile
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    -- Update workflow_jobs
    UPDATE workflow_jobs
    SET account_id = default_account_id
    WHERE account_id = existing_account_id;

    RAISE NOTICE 'Successfully consolidated all data to default account_id';
  ELSE
    RAISE NOTICE 'No existing account_id found, nothing to consolidate';
  END IF;
END $$;
