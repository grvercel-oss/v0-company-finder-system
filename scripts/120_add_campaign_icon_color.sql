-- Add icon and color columns to campaigns table
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'mail',
  ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT 'blue';

-- Update existing campaigns to have default values
UPDATE campaigns 
SET icon = 'mail', color = 'blue'
WHERE icon IS NULL OR color IS NULL;
