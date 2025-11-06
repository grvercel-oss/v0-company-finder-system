-- Create company_contacts table to store key personnel information
CREATE TABLE IF NOT EXISTS company_contacts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  linkedin_url TEXT,
  source TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0.75,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, email)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_contacts_company_id ON company_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_email ON company_contacts(email);

-- Enable RLS for multi-tenant support (if needed in future)
ALTER TABLE company_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy for company_contacts (allow all for now, can be restricted later)
CREATE POLICY company_contacts_policy ON company_contacts
  FOR ALL
  USING (true)
  WITH CHECK (true);
