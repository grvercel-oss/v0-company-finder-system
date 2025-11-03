-- Make zoho_message_id nullable to support multiple email providers
-- This allows us to store replies from both Zoho and Outlook

ALTER TABLE replies 
ALTER COLUMN zoho_message_id DROP NOT NULL;

-- Add a check constraint to ensure at least one message ID is present
ALTER TABLE replies 
ADD CONSTRAINT replies_message_id_check 
CHECK (zoho_message_id IS NOT NULL OR outlook_message_id IS NOT NULL);

-- Update existing records that might have NULL values
UPDATE replies 
SET zoho_message_id = outlook_message_id 
WHERE zoho_message_id IS NULL AND outlook_message_id IS NOT NULL;

UPDATE replies 
SET outlook_message_id = zoho_message_id 
WHERE outlook_message_id IS NULL AND zoho_message_id IS NOT NULL;
