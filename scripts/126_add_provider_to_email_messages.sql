-- Add provider column to email_messages table to track which provider was used for each message
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) CHECK (provider IN ('outlook', 'zoho'));

-- Add index for faster provider lookups
CREATE INDEX IF NOT EXISTS idx_email_messages_provider ON email_messages(provider);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_direction ON email_messages(thread_id, direction, sent_at DESC);

-- Update existing messages based on which message_id field is populated
UPDATE email_messages 
SET provider = CASE 
  WHEN outlook_message_id IS NOT NULL THEN 'outlook'
  WHEN zoho_message_id IS NOT NULL THEN 'zoho'
  ELSE NULL
END
WHERE provider IS NULL;
