-- Fix contacts with NULL or empty account_id
-- This ensures all contacts have a valid account_id

-- First, let's see how many contacts have NULL or empty account_id
DO $$
DECLARE
  null_count INTEGER;
  empty_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM contacts WHERE account_id IS NULL;
  SELECT COUNT(*) INTO empty_count FROM contacts WHERE account_id = '';
  
  RAISE NOTICE 'Contacts with NULL account_id: %', null_count;
  RAISE NOTICE 'Contacts with empty account_id: %', empty_count;
END $$;

-- Update contacts with NULL or empty account_id to use the first available account
-- This is a safe default for single-account setups
UPDATE contacts
SET account_id = (
  SELECT id FROM outlook_accounts LIMIT 1
)
WHERE account_id IS NULL OR account_id = '';

-- Verify the fix
DO $$
DECLARE
  remaining_null INTEGER;
  remaining_empty INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_null FROM contacts WHERE account_id IS NULL;
  SELECT COUNT(*) INTO remaining_empty FROM contacts WHERE account_id = '';
  
  RAISE NOTICE 'After fix - Contacts with NULL account_id: %', remaining_null;
  RAISE NOTICE 'After fix - Contacts with empty account_id: %', remaining_empty;
END $$;
