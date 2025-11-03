-- Create outreach campaigns table
CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  offer_description TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  total_contacts INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create outreach contacts table
CREATE TABLE IF NOT EXISTS outreach_contacts (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  company_name TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  company_info JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'email_generated', 'sent', 'replied', 'bounced')),
  email_subject TEXT,
  email_body TEXT,
  sent_at TIMESTAMP,
  replied_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_campaign_id ON outreach_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_status ON outreach_contacts(status);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_email ON outreach_contacts(email);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON outreach_campaigns(status);

-- Add trigger to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE outreach_campaigns
  SET 
    total_contacts = (SELECT COUNT(*) FROM outreach_contacts WHERE campaign_id = NEW.campaign_id),
    emails_sent = (SELECT COUNT(*) FROM outreach_contacts WHERE campaign_id = NEW.campaign_id AND status IN ('sent', 'replied')),
    replies_received = (SELECT COUNT(*) FROM outreach_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied'),
    updated_at = NOW()
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaign_stats_trigger
AFTER INSERT OR UPDATE ON outreach_contacts
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats();
