-- Phase 1: Create new search architecture tables

-- Search requests table - tracks each search query
CREATE TABLE IF NOT EXISTS search_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  raw_query TEXT NOT NULL,
  icp JSONB,
  status TEXT DEFAULT 'started' CHECK (status IN ('started', 'processing', 'completed', 'failed')),
  desired_count INT DEFAULT 20,
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Search results table - links searches to companies
CREATE TABLE IF NOT EXISTS search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_requests(id) ON DELETE CASCADE,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  score DOUBLE PRECISION DEFAULT 0,
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(search_id, company_id)
);

-- Update companies table for multi-source tracking
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_embedded BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_requests_account ON search_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_search_requests_status ON search_requests(status);
CREATE INDEX IF NOT EXISTS idx_search_results_search ON search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_search_results_company ON search_results(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- Enable RLS on new tables
ALTER TABLE search_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY search_requests_policy ON search_requests
  FOR ALL
  USING (account_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY search_results_policy ON search_results
  FOR ALL
  USING (
    search_id IN (
      SELECT id FROM search_requests 
      WHERE account_id = current_setting('app.current_user_id', TRUE)
    )
  );
