-- Create ai_usage_tracking table for tracking AI generation costs
CREATE TABLE IF NOT EXISTS ai_usage_tracking (
  id SERIAL PRIMARY KEY,
  
  -- Reference to campaign and contact
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  
  -- AI Model Information
  model VARCHAR(100) NOT NULL, -- e.g., 'gpt-4o-nano', 'gpt-4o-mini'
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  
  -- Cost Calculation (in USD)
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0.000000,
  
  -- Generation Type
  generation_type VARCHAR(50) DEFAULT 'email', -- 'email', 'subject', 'regenerate'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_campaign_id ON ai_usage_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_contact_id ON ai_usage_tracking(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage_tracking(model);
