-- Create junction table to link contacts with campaigns (many-to-many relationship)
-- This allows a contact to be added to multiple campaigns
CREATE TABLE IF NOT EXISTS campaign_contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES company_contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate entries
    UNIQUE(campaign_id, contact_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign 
ON campaign_contacts(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact 
ON campaign_contacts(contact_id);

-- Add comment to table
COMMENT ON TABLE campaign_contacts IS 'Junction table linking contacts to campaigns (many-to-many)';
