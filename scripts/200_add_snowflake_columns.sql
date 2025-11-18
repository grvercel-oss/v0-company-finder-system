-- Add Snowflake-specific columns to companies table
-- This allows us to track which companies came from Snowflake and when they were last synced

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS snowflake_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS snowflake_synced_at TIMESTAMP;

-- Create index for faster lookups by Snowflake ID
CREATE INDEX IF NOT EXISTS idx_companies_snowflake_id ON companies(snowflake_id);

-- Create index for sync timestamp to find stale data
CREATE INDEX IF NOT EXISTS idx_companies_snowflake_synced_at ON companies(snowflake_synced_at);

-- Add comment to explain the columns
COMMENT ON COLUMN companies.snowflake_id IS 'Company ID from Snowflake FlashIntel database';
COMMENT ON COLUMN companies.snowflake_synced_at IS 'Last time this company data was synced from Snowflake';
