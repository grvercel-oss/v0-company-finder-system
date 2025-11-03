-- Make password_hash nullable to support OAuth users who don't have passwords
-- OAuth users authenticate via external providers (Outlook, Zoho) and don't need password hashes

ALTER TABLE accounts 
  ALTER COLUMN password_hash DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN accounts.password_hash IS 'Password hash for local authentication. NULL for OAuth-only accounts.';
