-- Add indexes to optimize reply checking queries
-- These indexes will significantly improve performance when checking for replies

-- Index for finding contacts by thread_id (used in reply checking)
CREATE INDEX IF NOT EXISTS idx_contacts_thread_id_status 
ON contacts(thread_id, status) 
WHERE thread_id IS NOT NULL AND status IN ('sent', 'replied');

-- Index for finding contacts by email (used for matching incoming messages)
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower 
ON contacts(LOWER(email));

-- Index for finding threads by account_id and status
CREATE INDEX IF NOT EXISTS idx_email_threads_account_status 
ON email_threads(account_id, status) 
WHERE status IN ('active', 'sent', 'replied');

-- Index for checking existing replies by message IDs
CREATE INDEX IF NOT EXISTS idx_replies_outlook_message_id 
ON replies(outlook_message_id) 
WHERE outlook_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_replies_zoho_message_id 
ON replies(zoho_message_id) 
WHERE zoho_message_id IS NOT NULL;

-- Index for email_messages by message_id (for duplicate checking)
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id 
ON email_messages(message_id);

-- Index for contacts by sent_at (for time-based filtering)
CREATE INDEX IF NOT EXISTS idx_contacts_sent_at 
ON contacts(sent_at) 
WHERE sent_at IS NOT NULL;
