-- Create email configuration table
CREATE TABLE IF NOT EXISTS email_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  email TEXT NOT NULL,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL,
  smtp_user TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_config CHECK (id = 1)
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_email_config_id ON email_config(id);
