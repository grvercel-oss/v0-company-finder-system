-- Create investors table to store funding information for companies
CREATE TABLE IF NOT EXISTS investors (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    investor_name TEXT NOT NULL,
    investor_type TEXT, -- 'VC', 'Angel', 'Corporate', 'PE', etc.
    investor_website TEXT,
    investment_amount TEXT, -- e.g., '$10M', 'Undisclosed'
    investment_round TEXT, -- e.g., 'Seed', 'Series A', 'Series B'
    investment_date DATE,
    investment_year INTEGER,
    source TEXT DEFAULT 'Gemini Search',
    confidence_score NUMERIC(3, 2) DEFAULT 0.7,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(company_id, investor_name, investment_round)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_investors_company_id ON investors(company_id);
CREATE INDEX IF NOT EXISTS idx_investors_investor_name ON investors(investor_name);
CREATE INDEX IF NOT EXISTS idx_investors_investment_round ON investors(investment_round);

-- Add comment
COMMENT ON TABLE investors IS 'Stores investor and funding information for companies';
