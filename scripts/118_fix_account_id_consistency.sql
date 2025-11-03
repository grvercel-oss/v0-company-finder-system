-- Fix account_id consistency across environments
-- This ensures the same email always gets the same account_id

-- First, let's identify duplicate accounts by email
-- and merge them into a single account_id (keeping the oldest one)

-- Step 1: For each email, keep only the oldest account and update all references
DO $$
DECLARE
    email_record RECORD;
    primary_account_id TEXT;
BEGIN
    -- Loop through each unique email that has multiple accounts
    FOR email_record IN 
        SELECT email, MIN(created_at) as first_created
        FROM accounts
        GROUP BY email
        HAVING COUNT(*) > 1
    LOOP
        -- Get the account_id of the oldest account for this email
        SELECT id INTO primary_account_id
        FROM accounts
        WHERE email = email_record.email
        ORDER BY created_at ASC
        LIMIT 1;

        -- Update all related tables to use the primary account_id
        UPDATE campaigns SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE contacts SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE email_threads SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE email_messages SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE email_events SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE outlook_config SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE zoho_config SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE gmail_accounts SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE company_lists SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE user_profile SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE ai_usage_tracking SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE outreach_campaigns SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE outreach_contacts SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE replies SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        UPDATE workflow_jobs SET account_id = primary_account_id 
        WHERE account_id IN (SELECT id FROM accounts WHERE email = email_record.email AND id != primary_account_id);

        -- Delete duplicate accounts
        DELETE FROM accounts 
        WHERE email = email_record.email AND id != primary_account_id;

        RAISE NOTICE 'Merged accounts for email: % into account_id: %', email_record.email, primary_account_id;
    END LOOP;
END $$;

-- Step 2: Add unique constraint on email to prevent future duplicates
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_email_unique;
ALTER TABLE accounts ADD CONSTRAINT accounts_email_unique UNIQUE (email);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Account consolidation complete. Email uniqueness enforced.';
END $$;
