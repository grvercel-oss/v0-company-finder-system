-- Create outlook_config table for storing Outlook OAuth credentials
CREATE TABLE IF NOT EXISTS outlook_config (
  id SERIAL PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policies
ALTER TABLE outlook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outlook config"
  ON outlook_config FOR SELECT
  USING (account_id = current_setting('app.current_account_id', TRUE));

CREATE POLICY "Users can insert their own outlook config"
  ON outlook_config FOR INSERT
  WITH CHECK (account_id = current_setting('app.current_account_id', TRUE));

CREATE POLICY "Users can update their own outlook config"
  ON outlook_config FOR UPDATE
  USING (account_id = current_setting('app.current_account_id', TRUE));

CREATE POLICY "Users can delete their own outlook config"
  ON outlook_config FOR DELETE
  USING (account_id = current_setting('app.current_account_id', TRUE));
