-- Drop existing email config table
DROP TABLE IF EXISTS email_config;

-- Drop existing zoho_config table to recreate with correct schema
DROP TABLE IF EXISTS zoho_config;

-- Updated schema to remove client_id/secret per user (now global env vars)
-- Create zoho_config table for per-user Zoho Mail connections
CREATE TABLE zoho_config (
  id SERIAL PRIMARY KEY,
  
  -- User's OAuth tokens (per-user)
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMP,
  
  -- User's Account Info
  account_email VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  
  -- Data Center (for API endpoint)
  data_center VARCHAR(10) DEFAULT 'com', -- com, eu, in, au, jp, ca
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_zoho_config_active ON zoho_config(is_active);
CREATE INDEX idx_zoho_config_account_id ON zoho_config(account_id);
CREATE INDEX idx_zoho_config_account_email ON zoho_config(account_email);
