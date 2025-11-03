-- Create replies table to track email replies
CREATE TABLE IF NOT EXISTS replies (
  id SERIAL PRIMARY KEY,
  account_id TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  zoho_message_id TEXT NOT NULL,
  in_reply_to TEXT,
  -- Renamed from 'references' to 'email_references' to avoid SQL reserved keyword conflict
  email_references TEXT,
  subject TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  received_at TIMESTAMP NOT NULL,
  body_text TEXT,
  body_html TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_replies_account_id ON replies(account_id);
CREATE INDEX IF NOT EXISTS idx_replies_contact_id ON replies(contact_id);
CREATE INDEX IF NOT EXISTS idx_replies_thread_id ON replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_replies_message_id ON replies(message_id);
CREATE INDEX IF NOT EXISTS idx_replies_received_at ON replies(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_replies_processed ON replies(processed);
