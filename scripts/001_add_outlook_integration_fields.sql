-- Add Outlook-specific fields to support email sending via Microsoft Graph API
-- This script adds the outlook_message_id column that's referenced in the email sending code

-- Add outlook_message_id to email_messages table (CRITICAL - code tries to insert this)
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS outlook_message_id VARCHAR(255);

-- Add outlook_message_id to replies table (for reply tracking)
ALTER TABLE replies 
ADD COLUMN IF NOT EXISTS outlook_message_id VARCHAR(255);

-- Add outlook_message_id to contacts table (for sent email tracking)
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS outlook_message_id VARCHAR(255);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_messages_outlook_message_id ON email_messages(outlook_message_id);
CREATE INDEX IF NOT EXISTS idx_replies_outlook_message_id ON replies(outlook_message_id);
CREATE INDEX IF NOT EXISTS idx_contacts_outlook_message_id ON contacts(outlook_message_id);

-- Add unique constraints to prevent duplicate message tracking
ALTER TABLE email_messages 
ADD CONSTRAINT IF NOT EXISTS unique_outlook_message_id UNIQUE (outlook_message_id);

ALTER TABLE replies 
ADD CONSTRAINT IF NOT EXISTS unique_outlook_message_id_replies UNIQUE (outlook_message_id);
