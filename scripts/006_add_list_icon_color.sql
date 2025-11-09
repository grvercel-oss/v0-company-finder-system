-- Add icon and color columns to company_lists table
ALTER TABLE company_lists 
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'folder',
ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT 'gray';

-- Update existing lists to have default values
UPDATE company_lists 
SET icon = 'folder', color = 'gray' 
WHERE icon IS NULL OR color IS NULL;
