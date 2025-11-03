-- Make account_id and zoho_message_id nullable in all tables to prevent blocking inserts
-- This allows the system to work without requiring these fields in every operation

-- Remove NOT NULL constraint from contacts table
ALTER TABLE contacts 
ALTER COLUMN account_id DROP NOT NULL;

-- Remove NOT NULL constraint from email_messages table
ALTER TABLE email_messages 
ALTER COLUMN account_id DROP NOT NULL;

-- Remove NOT NULL constraint from replies table (both account_id and zoho_message_id)
ALTER TABLE replies 
ALTER COLUMN account_id DROP NOT NULL;

-- Make zoho_message_id nullable since Outlook messages don't have Zoho IDs
ALTER TABLE replies 
ALTER COLUMN zoho_message_id DROP NOT NULL;

-- Remove NOT NULL constraint from email_threads table (if it exists)
ALTER TABLE email_threads 
ALTER COLUMN account_id DROP NOT NULL;

-- Remove NOT NULL constraint from campaigns table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' 
        AND column_name = 'account_id'
    ) THEN
        ALTER TABLE campaigns ALTER COLUMN account_id DROP NOT NULL;
    END IF;
END $$;

-- Verify the changes
SELECT 
    table_name, 
    column_name, 
    is_nullable 
FROM information_schema.columns 
WHERE (column_name = 'account_id' OR column_name = 'zoho_message_id')
AND table_schema = 'public'
ORDER BY table_name, column_name;
