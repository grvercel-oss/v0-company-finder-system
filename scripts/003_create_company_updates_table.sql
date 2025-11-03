-- Create company updates table to track changes
CREATE TABLE IF NOT EXISTS company_updates (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  update_type VARCHAR(100), -- 'created', 'updated', 'verified'
  changes JSONB, -- Store what changed
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for company updates
CREATE INDEX IF NOT EXISTS idx_company_updates_company_id ON company_updates(company_id);
CREATE INDEX IF NOT EXISTS idx_company_updates_timestamp ON company_updates(updated_at DESC);
