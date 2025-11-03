-- Create email threads table for tracking conversations
CREATE TABLE IF NOT EXISTS email_threads (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Thread identification
  thread_id VARCHAR(255), -- Zoho Mail thread ID
  subject VARCHAR(500),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'replied', 'closed', 'archived')),
  has_unread_replies BOOLEAN DEFAULT false,
  last_message_at TIMESTAMP,
  last_reply_at TIMESTAMP,
  
  -- Counts
  message_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_threads_contact_id ON email_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_campaign_id ON email_threads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_thread_id ON email_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_has_unread ON email_threads(has_unread_replies);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(last_message_at DESC);
