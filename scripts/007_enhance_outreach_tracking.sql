-- Add Gmail integration and tracking fields to outreach_contacts
ALTER TABLE outreach_contacts
ADD COLUMN IF NOT EXISTS message_id TEXT,
ADD COLUMN IF NOT EXISTS thread_id TEXT,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS followup_subject TEXT,
ADD COLUMN IF NOT EXISTS followup_body TEXT,
ADD COLUMN IF NOT EXISTS followup_message_id TEXT,
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP;

-- Update status check constraint to include new statuses
ALTER TABLE outreach_contacts DROP CONSTRAINT IF EXISTS outreach_contacts_status_check;
ALTER TABLE outreach_contacts ADD CONSTRAINT outreach_contacts_status_check 
CHECK (status IN ('pending', 'email_generated', 'sent', 'opened', 'replied', 'followup_sent', 'bounced', 'failed'));

-- Create table for Gmail OAuth tokens
CREATE TABLE IF NOT EXISTS gmail_accounts (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create table for email events tracking
CREATE TABLE IF NOT EXISTS email_events (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),
  message_id TEXT,
  thread_id TEXT,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create table for workflow jobs (for 24h follow-up timer)
CREATE TABLE IF NOT EXISTS workflow_jobs (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('send_initial', 'check_reply', 'send_followup')),
  scheduled_at TIMESTAMP NOT NULL,
  executed_at TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_message_id ON outreach_contacts(message_id);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_thread_id ON outreach_contacts(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_events_contact_id ON email_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_workflow_jobs_scheduled_at ON workflow_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_workflow_jobs_status ON workflow_jobs(status);

-- Add trigger to create workflow job when email is sent
CREATE OR REPLACE FUNCTION create_followup_job()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    -- Schedule a check_reply job for 24 hours later
    INSERT INTO workflow_jobs (contact_id, job_type, scheduled_at, status)
    VALUES (NEW.id, 'check_reply', NOW() + INTERVAL '24 hours', 'pending');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_followup_job_trigger
AFTER UPDATE ON outreach_contacts
FOR EACH ROW
EXECUTE FUNCTION create_followup_job();
