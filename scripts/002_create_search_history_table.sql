-- Create search history table to track user searches
CREATE TABLE IF NOT EXISTS search_history (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  filters JSONB, -- Store filter parameters
  results_count INTEGER,
  search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for search history
CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(search_timestamp DESC);
