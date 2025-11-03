-- Add thread tracking to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS thread_id INTEGER REFERENCES email_threads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS zoho_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS zoho_thread_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_reply_check_at TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_thread_id ON contacts(thread_id);
CREATE INDEX IF NOT EXISTS idx_contacts_zoho_message_id ON contacts(zoho_message_id);
CREATE INDEX IF NOT EXISTS idx_contacts_zoho_thread_id ON contacts(zoho_thread_id);
