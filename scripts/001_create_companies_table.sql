-- Create companies table to store company information
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE,
  description TEXT,
  industry VARCHAR(255),
  size VARCHAR(100),
  location VARCHAR(255),
  founded_year INTEGER,
  website VARCHAR(500),
  linkedin_url VARCHAR(500),
  twitter_url VARCHAR(500),
  employee_count VARCHAR(100),
  revenue_range VARCHAR(100),
  funding_stage VARCHAR(100),
  total_funding VARCHAR(100),
  technologies TEXT[], -- Array of technologies used
  keywords TEXT[], -- Array of keywords for search
  logo_url VARCHAR(500),
  raw_data JSONB, -- Store raw scraped data
  ai_summary TEXT, -- AI-generated summary
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_quality_score INTEGER DEFAULT 0, -- 0-100 score for data completeness
  verified BOOLEAN DEFAULT FALSE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(location);
CREATE INDEX IF NOT EXISTS idx_companies_keywords ON companies USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_companies_technologies ON companies USING GIN(technologies);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);
