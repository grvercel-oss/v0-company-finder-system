-- Add unique constraint to replies table for message_id deduplication
-- This allows ON CONFLICT to work properly when inserting replies

-- First, remove any duplicate entries that might exist
DELETE FROM replies a USING replies b
WHERE a.id > b.id 
AND a.zoho_message_id = b.zoho_message_id;

-- Now add the unique constraint
ALTER TABLE replies 
ADD CONSTRAINT replies_zoho_message_id_unique UNIQUE (zoho_message_id);

-- Also add a unique constraint on message_id for additional safety
ALTER TABLE replies 
ADD CONSTRAINT replies_message_id_unique UNIQUE (message_id);
