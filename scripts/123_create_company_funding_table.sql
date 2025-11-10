-- Create table to store detailed funding and investor information
CREATE TABLE IF NOT EXISTS company_funding (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Funding round details
  round_type VARCHAR(100), -- Seed, Series A, Series B, etc.
  amount_usd DECIMAL(15, 2), -- Funding amount in USD
  currency VARCHAR(10) DEFAULT 'USD',
  announced_date DATE,
  
  -- Investors
  lead_investors TEXT[], -- Array of lead investor names
  other_investors TEXT[], -- Array of other participating investors
  
  -- Valuation
  pre_money_valuation DECIMAL(15, 2),
  post_money_valuation DECIMAL(15, 2),
  
  -- Metadata
  source_url VARCHAR(500),
  confidence_score INTEGER DEFAULT 0, -- 0-100 AI confidence in data accuracy
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_funding_company_id ON company_funding(company_id);
CREATE INDEX IF NOT EXISTS idx_funding_announced_date ON company_funding(announced_date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_round_type ON company_funding(round_type);

-- Create table for financial metrics
CREATE TABLE IF NOT EXISTS company_financials (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Financial data
  fiscal_year INTEGER,
  fiscal_quarter INTEGER, -- 1, 2, 3, 4 or NULL for annual
  revenue DECIMAL(15, 2),
  profit DECIMAL(15, 2),
  ebitda DECIMAL(15, 2),
  total_assets DECIMAL(15, 2),
  total_liabilities DECIMAL(15, 2),
  cash_on_hand DECIMAL(15, 2),
  burn_rate DECIMAL(15, 2), -- Monthly burn rate
  runway_months INTEGER,
  
  -- Growth metrics
  revenue_growth_pct DECIMAL(5, 2),
  user_count BIGINT,
  arr DECIMAL(15, 2), -- Annual Recurring Revenue
  mrr DECIMAL(15, 2), -- Monthly Recurring Revenue
  
  -- Metadata
  source VARCHAR(100), -- SEC, Company Website, News, etc.
  source_url VARCHAR(500),
  confidence_score INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, fiscal_year, fiscal_quarter)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_financials_company_id ON company_financials(company_id);
CREATE INDEX IF NOT EXISTS idx_financials_year ON company_financials(fiscal_year DESC);
