-- Create email messages table for storing individual messages in threads
CREATE TABLE IF NOT EXISTS email_messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES email_threads(id) ON DELETE CASCADE,
  
  -- Message identification
  message_id VARCHAR(255) UNIQUE, -- Zoho Mail message ID
  zoho_message_id VARCHAR(255), -- Zoho's internal message ID
  
  -- Message details
  direction VARCHAR(10) CHECK (direction IN ('sent', 'received')),
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),
  subject VARCHAR(500),
  body TEXT,
  html_body TEXT,
  
  -- Message metadata
  is_read BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT, -- Store the prompt used for AI-generated replies
  
  -- Timestamps
  sent_at TIMESTAMP,
  received_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at DESC);
