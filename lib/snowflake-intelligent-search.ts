/**
 * Intelligent search system for Snowflake company database
 * Uses AI to understand natural language queries and map them to database fields
 */

interface ParsedSearchQuery {
  keywords: string[]
  industries: string[]
  locations: string[]
  companyTypes: string[]
  technologies: string[]
  employeeSize?: string
}

/**
 * Industry keywords mapping for common search terms
 */
const industryMappings: Record<string, string[]> = {
  "ai": ["Artificial Intelligence", "Machine Learning", "AI", "ML", "Deep Learning", "Neural Networks"],
  "artificial intelligence": ["Artificial Intelligence", "Machine Learning", "AI", "ML"],
  "ml": ["Machine Learning", "ML", "Artificial Intelligence", "AI"],
  "machine learning": ["Machine Learning", "ML", "Artificial Intelligence"],
  "tech": ["Technology", "Software", "IT", "Information Technology", "Tech"],
  "technology": ["Technology", "Software", "IT", "Information Technology"],
  "software": ["Software", "Technology", "SaaS", "IT"],
  "saas": ["SaaS", "Software as a Service", "Cloud Computing", "Software"],
  "fintech": ["Fintech", "Financial Technology", "Finance", "Banking"],
  "healthcare": ["Healthcare", "Medical", "Health", "Pharmaceutical", "Biotech"],
  "ecommerce": ["E-commerce", "Ecommerce", "Retail", "Online Shopping"],
  "crypto": ["Cryptocurrency", "Blockchain", "Crypto", "Web3", "DeFi"],
  "blockchain": ["Blockchain", "Cryptocurrency", "Web3", "DeFi"],
  "biotech": ["Biotechnology", "Biotech", "Life Sciences", "Healthcare"],
  "edtech": ["Education Technology", "Edtech", "E-learning", "Education"],
  "marketing": ["Marketing", "Advertising", "AdTech", "MarTech"],
  "cybersecurity": ["Cybersecurity", "Security", "Information Security", "InfoSec"],
  "cloud": ["Cloud Computing", "Cloud", "Infrastructure", "IaaS", "PaaS"],
  "data": ["Data Analytics", "Big Data", "Data Science", "Analytics"],
}

/**
 * Company type keywords
 */
const companyTypeMappings: Record<string, string[]> = {
  "startup": ["startup", "early stage", "seed", "series a"],
  "startups": ["startup", "early stage", "seed", "series a"],
  "enterprise": ["enterprise", "large company", "corporation"],
  "sme": ["SME", "small business", "medium business"],
  "public": ["public company", "publicly traded"],
  "private": ["private company", "privately held"],
}

/**
 * Parse natural language search query into structured search parameters
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const lowerQuery = query.toLowerCase()
  const words = lowerQuery.split(/\s+/)
  
  const parsed: ParsedSearchQuery = {
    keywords: [],
    industries: [],
    locations: [],
    companyTypes: [],
    technologies: [],
  }

  // Check for industry keywords
  for (const [key, values] of Object.entries(industryMappings)) {
    if (lowerQuery.includes(key)) {
      parsed.industries.push(...values)
    }
  }

  // Check for company type keywords
  for (const [key, values] of Object.entries(companyTypeMappings)) {
    if (lowerQuery.includes(key)) {
      parsed.companyTypes.push(...values)
    }
  }

  // Extract remaining keywords (words not matched to specific categories)
  const matchedWords = new Set([
    ...Object.keys(industryMappings),
    ...Object.keys(companyTypeMappings)
  ])
  
  parsed.keywords = words.filter(word => 
    word.length > 2 && !matchedWords.has(word)
  )

  return parsed
}

/**
 * Build SQL WHERE clause from parsed query
 */
export function buildIntelligentSearchSQL(
  tableName: string,
  query: string,
  additionalFilters?: {
    location?: string
    employeeRange?: string
  }
): string {
  const parsed = parseSearchQuery(query)
  const conditions: string[] = []

  // Industry conditions (most important for "AI Startups" type queries)
  if (parsed.industries.length > 0) {
    const industryConditions = parsed.industries.map(industry => 
      `(
        LOWER(INDUSTRY) LIKE LOWER('%${industry}%')
        OR LOWER(INDUSTRY_1) LIKE LOWER('%${industry}%')
        OR LOWER(INDUSTRY_2) LIKE LOWER('%${industry}%')
        OR LOWER(INDUSTRY_3) LIKE LOWER('%${industry}%')
        OR LOWER(BUSINESS_KEYWORDS) LIKE LOWER('%${industry}%')
        OR LOWER(INTRO) LIKE LOWER('%${industry}%')
      )`
    ).join(" OR ")
    
    conditions.push(`(${industryConditions})`)
  }

  // Company type conditions
  if (parsed.companyTypes.length > 0) {
    const typeConditions = parsed.companyTypes.map(type =>
      `LOWER(COMPANY_TYPE) LIKE LOWER('%${type}%')`
    ).join(" OR ")
    
    conditions.push(`(${typeConditions})`)
  }

  // General keyword search (fallback for unmatched terms)
  if (parsed.keywords.length > 0) {
    const keywordConditions = parsed.keywords.map(keyword =>
      `(
        LOWER(COMPANY_NAME) LIKE LOWER('%${keyword}%')
        OR LOWER(INTRO) LIKE LOWER('%${keyword}%')
        OR LOWER(BUSINESS_KEYWORDS) LIKE LOWER('%${keyword}%')
        OR LOWER(PRODUCTS_OFFERED) LIKE LOWER('%${keyword}%')
        OR LOWER(SERVICES_OFFERED) LIKE LOWER('%${keyword}%')
      )`
    ).join(" OR ")
    
    if (keywordConditions) {
      conditions.push(`(${keywordConditions})`)
    }
  }

  // If no specific conditions matched, do a broad search on the full query
  if (conditions.length === 0 && query.trim()) {
    conditions.push(`(
      LOWER(COMPANY_NAME) LIKE LOWER('%${query.trim()}%')
      OR LOWER(INTRO) LIKE LOWER('%${query.trim()}%')
      OR LOWER(INDUSTRY) LIKE LOWER('%${query.trim()}%')
      OR LOWER(BUSINESS_KEYWORDS) LIKE LOWER('%${query.trim()}%')
    )`)
  }

  // Add location filter if provided
  if (additionalFilters?.location && additionalFilters.location.trim()) {
    conditions.push(`(
      LOWER(CITY) LIKE LOWER('%${additionalFilters.location.trim()}%')
      OR LOWER(PROVINCE) LIKE LOWER('%${additionalFilters.location.trim()}%')
      OR LOWER(COUNTRY) LIKE LOWER('%${additionalFilters.location.trim()}%')
    )`)
  }

  // Add employee range filter if provided
  if (additionalFilters?.employeeRange && additionalFilters.employeeRange.trim()) {
    conditions.push(`STAFF_RANGE = '${additionalFilters.employeeRange.trim()}'`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "WHERE 1=1"

  const sqlText = `
    SELECT 
      COMPANY_ID,
      COMPANY_NAME,
      COMPANY_DOMAIN,
      PRIMARY_DOMAIN,
      CEO,
      CITY,
      COUNTRY,
      PROVINCE,
      POSTCODE,
      COMPANY_TYPE,
      INDUSTRY,
      INDUSTRY_1,
      INDUSTRY_2,
      INDUSTRY_3,
      STAFF_RANGE,
      FOUND_YEAR,
      INTRO,
      LINK,
      LINK_LINKEDIN,
      LINK_TWITTER,
      LINK_FACEBOOK,
      LINK_INS,
      LOGO,
      TECH_STACKS,
      PRODUCTS_OFFERED,
      SERVICES_OFFERED,
      BUSINESS_KEYWORDS,
      CONTACT_ADDRESS,
      HQ,
      STOCK_CODE,
      STOCK_EXCHANGE,
      NAICS_CODE
    FROM ${tableName}
    ${whereClause}
    ORDER BY FOUND_YEAR DESC NULLS LAST
  `

  return sqlText
}
