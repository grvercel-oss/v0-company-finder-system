-- Add performance indexes for frequently queried columns
-- These improve query performance for the email sending and campaign management features

-- Contacts table indexes
CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);

-- Email threads indexes
CREATE INDEX IF NOT EXISTS idx_email_threads_contact_id ON email_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_campaign_id ON email_threads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_account_id ON email_threads(account_id);

-- Email messages indexes
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);

-- Campaigns indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);

-- Replies indexes
CREATE INDEX IF NOT EXISTS idx_replies_contact_id ON replies(contact_id);
CREATE INDEX IF NOT EXISTS idx_replies_processed ON replies(processed);
CREATE INDEX IF NOT EXISTS idx_replies_account_id ON replies(account_id);

-- Companies indexes (for search performance)
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_verified ON companies(verified);
CREATE INDEX IF NOT EXISTS idx_companies_data_quality_score ON companies(data_quality_score);
