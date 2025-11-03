-- Clean up orphaned records in account_email_provider that reference non-existent accounts
-- This ensures all FK constraints are valid before implementing the new OAuth flow

-- Step 1: Log orphaned records before deletion
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM account_email_provider
  WHERE account_id NOT IN (SELECT id FROM accounts);
  
  RAISE NOTICE 'Found % orphaned provider records to delete', orphaned_count;
END $$;

-- Step 2: Delete orphaned records
DELETE FROM account_email_provider
WHERE account_id NOT IN (SELECT id FROM accounts);

-- Step 3: Verify cleanup
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM account_email_provider
  WHERE account_id NOT IN (SELECT id FROM accounts);
  
  IF remaining_count > 0 THEN
    RAISE WARNING 'Still have % orphaned records after cleanup', remaining_count;
  ELSE
    RAISE NOTICE 'All orphaned records cleaned up successfully';
  END IF;
END $$;

-- Step 4: Verify all provider records now have valid account references
SELECT 
  aep.account_id,
  aep.provider,
  CASE 
    WHEN a.id IS NOT NULL THEN 'Valid'
    ELSE 'Invalid (orphaned)'
  END as status
FROM account_email_provider aep
LEFT JOIN accounts a ON aep.account_id = a.id;
