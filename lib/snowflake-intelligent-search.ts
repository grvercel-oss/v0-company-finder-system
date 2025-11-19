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
  filters?: {
    location?: string
    employeeRange?: string
  }
): string {
  const parsed = parseSearchQuery(query)
  const conditions: string[] = []

  const searchConditions: string[] = []

  // Industry conditions
  if (parsed.industries.length > 0) {
    const industryConditions = parsed.industries.map(industry => 
      `LOWER(INDUSTRY) LIKE LOWER('%${industry}%')`
    ).join(" OR ")
    
    searchConditions.push(`(${industryConditions})`)
  }

  // General keyword search
  if (parsed.keywords.length > 0) {
    const keywordConditions = parsed.keywords.map(keyword =>
      `LOWER(NAME) LIKE LOWER('%${keyword}%')`
    ).join(" OR ")
    
    if (keywordConditions) {
      searchConditions.push(`(${keywordConditions})`)
    }
  }

  // If no specific conditions matched, do a broad search
  if (searchConditions.length === 0 && query.trim()) {
    searchConditions.push(`(
      LOWER(NAME) LIKE LOWER('%${query.trim()}%')
      OR LOWER(INDUSTRY) LIKE LOWER('%${query.trim()}%')
    )`)
  }

  // Combine search conditions with OR logic
  if (searchConditions.length > 0) {
    conditions.push(`(${searchConditions.join(" OR ")})`)
  }

  // Add location filter
  if (filters?.location || parsed.locations.length > 0) {
    const loc = filters?.location || parsed.locations[0]
    if (loc) {
      conditions.push(`(
        LOWER(LOCALITY) LIKE LOWER('%${loc}%')
        OR LOWER(REGION) LIKE LOWER('%${loc}%')
        OR LOWER(COUNTRY) LIKE LOWER('%${loc}%')
      )`)
    }
  }

  // Add employee range filter
  if (filters?.employeeRange) {
    conditions.push(`SIZE = '${filters.employeeRange}'`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "WHERE 1=1"

  // Build ORDER BY for relevance
  let orderBy = "ORDER BY "
  if (parsed.keywords.length > 0 || query.trim()) {
    const term = parsed.keywords[0] || query.trim()
    orderBy += `
      CASE 
        WHEN LOWER(NAME) = LOWER('${term}') THEN 1
        WHEN LOWER(NAME) LIKE LOWER('${term}%') THEN 2
        ELSE 3
      END,
    `
  }
  orderBy += "FOUNDED DESC NULLS LAST"

  const sqlText = `
    SELECT 
      ID,
      NAME,
      WEBSITE,
      INDUSTRY,
      LOCALITY,
      REGION,
      COUNTRY,
      SIZE,
      FOUNDED,
      LINKEDIN_URL
    FROM ${tableName}
    ${whereClause}
    ${orderBy}
  `

  console.log("[v0] [Intelligent Search] Generated SQL:", sqlText)
  console.log("[v0] [Intelligent Search] Parsed query:", JSON.stringify(parsed, null, 2))

  return sqlText
}
