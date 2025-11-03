-- Add cost tracking columns to search_history table
ALTER TABLE search_history 
ADD COLUMN IF NOT EXISTS perplexity_input_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS perplexity_output_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS perplexity_cost DECIMAL(10, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS openai_input_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS openai_output_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS openai_cost DECIMAL(10, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 6) DEFAULT 0;

-- Create index for cost analysis
CREATE INDEX IF NOT EXISTS idx_search_history_cost ON search_history(total_cost DESC);
