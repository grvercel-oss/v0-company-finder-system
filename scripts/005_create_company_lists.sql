-- Create company_lists table to store user-created lists
CREATE TABLE IF NOT EXISTS company_lists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create company_list_items junction table to link companies to lists
CREATE TABLE IF NOT EXISTS company_list_items (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES company_lists(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  UNIQUE(list_id, company_id) -- Prevent duplicate entries
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_company_lists_name ON company_lists(name);
CREATE INDEX IF NOT EXISTS idx_company_lists_created_at ON company_lists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_list_items_list_id ON company_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_company_list_items_company_id ON company_list_items(company_id);
CREATE INDEX IF NOT EXISTS idx_company_list_items_added_at ON company_list_items(added_at DESC);
