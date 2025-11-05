-- Add pgvector extension and embedding column for semantic search

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to companies table (384 dimensions for text-embedding-3-small)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Create vector index for fast similarity search
CREATE INDEX IF NOT EXISTS companies_embedding_idx ON companies 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add full-text search column and index
ALTER TABLE companies ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS companies_search_vector_idx ON companies USING gin(search_vector);

-- Function to update search_vector automatically
CREATE OR REPLACE FUNCTION companies_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.industry, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search_vector on insert/update
DROP TRIGGER IF EXISTS companies_search_vector_trigger ON companies;
CREATE TRIGGER companies_search_vector_trigger
BEFORE INSERT OR UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION companies_search_vector_update();

-- Backfill search_vector for existing companies
UPDATE companies SET search_vector = 
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(industry, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(keywords, ' '), '')), 'D')
WHERE search_vector IS NULL;
