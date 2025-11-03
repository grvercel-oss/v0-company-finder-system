-- Add notification tracking to replies table
ALTER TABLE replies
ADD COLUMN IF NOT EXISTS notification_shown BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_clicked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_shown_at TIMESTAMP;

-- Create index for efficient notification queries
CREATE INDEX IF NOT EXISTS idx_replies_notification_shown ON replies(notification_shown, detected_at DESC);
