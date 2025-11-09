-- Add email_prompt column to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_prompt TEXT;

-- Add helpful comment
COMMENT ON COLUMN campaigns.email_prompt IS 'Custom prompt/instructions for AI email generation';
