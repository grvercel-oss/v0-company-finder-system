-- Add columns to contacts table for tracking email edits
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS original_subject TEXT,
ADD COLUMN IF NOT EXISTS original_body TEXT,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS generation_count INTEGER DEFAULT 0;

-- Create index for edited emails
CREATE INDEX IF NOT EXISTS idx_contacts_edited_at ON contacts(edited_at);
