-- Add column to store Tavily research data
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS tavily_research JSONB,
ADD COLUMN IF NOT EXISTS tavily_research_fetched_at TIMESTAMP;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_companies_tavily_research_fetched_at 
ON companies(tavily_research_fetched_at);

-- Add comment
COMMENT ON COLUMN companies.tavily_research IS 'Stores research data from Tavily API about the company';
COMMENT ON COLUMN companies.tavily_research_fetched_at IS 'Timestamp when Tavily research was last fetched';
