-- Clear ALL "Get More Info" research data from the database
-- Run this script to remove all cached research information

-- 1. Clear ALL research-related data from companies table
UPDATE companies
SET 
  tavily_research = NULL,
  tavily_research_fetched_at = NULL,
  ai_summary = NULL,
  raw_data = NULL,
  sources = NULL,
  last_enriched_at = NULL,
  employee_count = NULL,
  revenue_range = NULL,
  funding_stage = NULL,
  total_funding = NULL,
  technologies = NULL;

-- 2. Delete all company update history
DELETE FROM company_updates;

-- 3. Optional: Delete all company contacts from Hunter/Apollo
-- Uncomment the line below if you want to also clear contact data
-- DELETE FROM company_contacts;

-- Show results
SELECT 
  'Cleared research data from ' || COUNT(*) || ' companies' as result
FROM companies;
