-- Clear all cached research data to force fresh OpenAI research
UPDATE companies
SET 
  tavily_research = NULL,
  tavily_research_fetched_at = NULL
WHERE tavily_research IS NOT NULL;
