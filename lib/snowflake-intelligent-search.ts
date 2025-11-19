/**
 * Intelligent search system for Snowflake company database
 * Uses AI to understand natural language queries and map them to database fields
 */

import { createOpenAI } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

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
 * Define the schema for AI search parameters
 */
const SearchParamsSchema = z.object({
  keywords: z.array(z.string()).describe("Keywords to search for in company name or description"),
  industries: z.array(z.string()).describe("Specific industries to filter by (e.g. 'financial services', 'software')"),
  locations: z.array(z.string()).describe("Locations to filter by (city, state, country)"),
  employeeSize: z.string().optional().describe("Employee size range (e.g. '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+')"),
  foundedYear: z.number().optional().describe("Founded year"),
  foundedOperator: z.enum([">", "<", "=", ">=", "<="]).optional().describe("Operator for founded year comparison"),
  sqlWhere: z.string().optional().describe("Optional raw SQL WHERE clause for complex logic"),
})

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
 * Parse natural language search query into structured search parameters using Groq
 */
export async function parseSearchQueryWithGroq(query: string): Promise<z.infer<typeof SearchParamsSchema>> {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.warn("[v0] [Intelligent Search] GROQ_API_KEY not found, falling back to basic parsing")
      return parseSearchQuery(query)
    }

    const groq = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    })

    const { object } = await generateObject({
      model: groq("llama-3.3-70b-versatile"),
      schema: SearchParamsSchema,
      prompt: `
        You are an expert at converting natural language search queries into structured search parameters for a company database.
        The database is People Data Labs (PDL) in Snowflake.
        
        Schema:
        - NAME (string)
        - INDUSTRY (string)
        - LOCALITY (string)
        - REGION (string)
        - COUNTRY (string)
        - SIZE (string, e.g. '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+')
        - FOUNDED (number, year)
        
        User Query: "${query}"
        
        Extract the relevant filters.
        For "AI startups", "AI" is an industry/keyword and "startup" implies small size or recent founded date.
        For "Financial services in US", "financial services" is industry, "US" is location.
        
        Return a structured JSON object.
      `,
    })

    return object
  } catch (error) {
    console.error("[v0] [Intelligent Search] Groq parsing failed:", error)
    return parseSearchQuery(query)
  }
}

/**
 * Build SQL WHERE clause from parsed query
 */
export async function buildIntelligentSearchSQL(
  tableName: string,
  query: string,
  filters?: {
    location?: string
    employeeRange?: string
  }
): Promise<string> {
  // Try AI parsing first, fall back to basic
  let parsed: any
  try {
    parsed = await parseSearchQueryWithGroq(query)
  } catch (e) {
    parsed = parseSearchQuery(query)
  }

  // Override with explicit filters if provided
  if (filters?.location) parsed.locations = [filters.location]
  if (filters?.employeeRange) parsed.employeeSize = filters.employeeRange

  const conditions: string[] = []
  const searchConditions: string[] = []

  // Industry conditions
  if (parsed.industries && parsed.industries.length > 0) {
    const industryConditions = parsed.industries.map((industry: string) => 
      `LOWER(INDUSTRY) LIKE LOWER('%${industry}%')`
    ).join(" OR ")
    
    searchConditions.push(`(${industryConditions})`)
  }

  // General keyword search
  if (parsed.keywords && parsed.keywords.length > 0) {
    const keywordConditions = parsed.keywords.map((keyword: string) =>
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
  if (parsed.locations && parsed.locations.length > 0) {
    const locConditions = parsed.locations.map((loc: string) => `(
      LOWER(LOCALITY) LIKE LOWER('%${loc}%')
      OR LOWER(REGION) LIKE LOWER('%${loc}%')
      OR LOWER(COUNTRY) LIKE LOWER('%${loc}%')
    )`).join(" OR ")
    
    conditions.push(`(${locConditions})`)
  }

  // Add employee range filter
  if (parsed.employeeSize) {
    conditions.push(`SIZE = '${parsed.employeeSize}'`)
  }

  // Add founded year filter
  if (parsed.foundedYear) {
    const op = parsed.foundedOperator || "="
    conditions.push(`FOUNDED ${op} ${parsed.foundedYear}`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "WHERE 1=1"

  // Build ORDER BY for relevance
  let orderBy = "ORDER BY "
  if ((parsed.keywords && parsed.keywords.length > 0) || query.trim()) {
    const term = (parsed.keywords && parsed.keywords[0]) || query.trim()
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
