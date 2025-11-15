-- Create investors table to store funding information
CREATE TABLE IF NOT EXISTS investors (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  investor_name VARCHAR(255) NOT NULL,
  investor_type VARCHAR(100), -- 'VC', 'Angel', 'Corporate', 'PE', etc.
  investor_website VARCHAR(500),
  investment_amount VARCHAR(100), -- e.g., '$10M', 'Undisclosed'
  investment_round VARCHAR(100), -- e.g., 'Series A', 'Seed', 'Series B'
  investment_date DATE,
  investment_year INTEGER,
  source VARCHAR(255), -- Where the data came from
  confidence_score NUMERIC(3,2) DEFAULT 0.70,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, investor_name, investment_round)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_investors_company_id ON investors(company_id);
CREATE INDEX IF NOT EXISTS idx_investors_investor_name ON investors(investor_name);

-- Add comment
COMMENT ON TABLE investors IS 'Stores investor and funding information for companies';
