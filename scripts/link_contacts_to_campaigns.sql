-- Add campaign_id to company_contacts table to link contacts with campaigns
ALTER TABLE company_contacts
ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_company_contacts_campaign_id ON company_contacts(campaign_id);

-- Update existing contacts to clear campaign_id (in case column already existed)
UPDATE company_contacts SET campaign_id = NULL WHERE campaign_id IS NOT NULL;
