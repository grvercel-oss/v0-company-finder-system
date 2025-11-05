-- Add deleted_at column to campaigns table for soft delete functionality
-- This preserves analytics data even when campaigns are "deleted"

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add index for better query performance when filtering deleted campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at ON campaigns(deleted_at);

-- Add comment to explain the column
COMMENT ON COLUMN campaigns.deleted_at IS 'Timestamp when campaign was soft deleted. NULL means active campaign.';
