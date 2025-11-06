-- Add email verification status to company_contacts table
ALTER TABLE company_contacts 
ADD COLUMN IF NOT EXISTS email_verification_status VARCHAR(20) DEFAULT 'pending';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_company_contacts_verification 
ON company_contacts(email_verification_status);

-- Update existing contacts to pending
UPDATE company_contacts 
SET email_verification_status = 'pending' 
WHERE email_verification_status IS NULL;
