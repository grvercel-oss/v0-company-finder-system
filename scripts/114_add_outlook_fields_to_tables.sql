-- Add Outlook-specific fields to existing tables

-- Add outlook_message_id to email_messages table
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS outlook_message_id VARCHAR(255);

-- Add outlook_message_id to replies table
ALTER TABLE replies 
ADD COLUMN IF NOT EXISTS outlook_message_id VARCHAR(255);

-- Add outlook_message_id to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS outlook_message_id VARCHAR(255);

-- Add account_id to email_threads table if not exists
ALTER TABLE email_threads 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to email_messages table if not exists
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Create indexes for Outlook message IDs
CREATE INDEX IF NOT EXISTS idx_email_messages_outlook_message_id ON email_messages(outlook_message_id);
CREATE INDEX IF NOT EXISTS idx_replies_outlook_message_id ON replies(outlook_message_id);
CREATE INDEX IF NOT EXISTS idx_contacts_outlook_message_id ON contacts(outlook_message_id);

-- Add unique constraint for outlook_message_id in email_messages
ALTER TABLE email_messages 
ADD CONSTRAINT unique_outlook_message_id UNIQUE (outlook_message_id);

-- Add unique constraint for outlook_message_id in replies
ALTER TABLE replies 
ADD CONSTRAINT unique_outlook_message_id_replies UNIQUE (outlook_message_id);
