// New research system using Groq AI + Brave Search API
// Replaces expensive Tavily and limited DuckDuckGo with comprehensive Brave Search

interface BraveSearchResult {
  title: string
  url: string
  description: string
  page_age?: string
  page_fetched?: string
}

interface BraveWebResult {
  type: string
  web?: {
    type: string
    results: BraveSearchResult[]
  }
  query?: {
    original: string
  }
}

interface QueryCategory {
  category_name: string
  query_prefix: string
  queries: string[]
}

interface ResearchResult {
  query: string
  answer: string
  sources: Array<{
    title: string
    url: string
    content: string
  }>
}

export interface CorporateRegistryData {
  company_name: string
  registry_name: string
  registry_url: string
  registration_id: string
  date_of_incorporation: string
  status: string
  directors: string[]
  major_shareholders: string[]
  financials_summary: string
  source_url: string
  country: string
}

// Query generation prompt based on user's template
const QUERY_CATEGORIES: QueryCategory[] = [
  {
    category_name: "Company Queries",
    query_prefix: "{target_company}",
    queries: [
      "core products and services",
      "company history and milestones",
      "leadership team",
      "business model and strategy",
    ],
  },
  {
    category_name: "Industry Queries",
    query_prefix: "{target_company}",
    queries: ["market position", "main competitors", "industry challenges and trends", "market size and growth"],
  },
  {
    category_name: "Financial Queries",
    query_prefix: "{target_company}",
    queries: ["fundraising history and valuation", "revenue sources", "financial performance"],
  },
  {
    category_name: "News Queries",
    query_prefix: "{target_company}",
    queries: [
      "recent company announcements",
      "latest press releases",
      "new partnerships 2025",
      "news updates November 2025",
    ],
  },
]

/**
 * Strip markdown code blocks from JSON responses
 */
function extractJSON(content: string): string {
  // Remove markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    return jsonMatch[1].trim()
  }
  return content.trim()
}

/**
 * Generate search queries using Groq AI based on the company
 */
async function generateSearchQueries(companyName: string): Promise<string[]> {
  console.log("[v0] [GROQ] Generating search queries for:", companyName)

  const apiKey = process.env.API_KEY_GROQ_API_KEY

  if (!apiKey) {
    throw new Error("API_KEY_GROQ_API_KEY environment variable is not set")
  }

  const prompt = `You are a research query generator. Generate 12-15 specific search queries about "${companyName}" company.

Follow this structure:

**Company Queries** (4 queries):
- ${companyName} core products and services
- ${companyName} company history and milestones  
- ${companyName} leadership team
- ${companyName} business model and strategy

**Industry Queries** (4 queries):
- ${companyName} market position
- ${companyName} main competitors
- ${companyName} industry challenges and trends
- ${companyName} market size and growth

**Financial Queries** (3 queries):
- ${companyName} fundraising history and valuation
- ${companyName} revenue sources
- ${companyName} financial performance

**News Queries** (4 queries):
- ${companyName} recent company announcements
- ${companyName} latest press releases
- ${companyName} new partnerships 2025
- ${companyName} news updates November 2025

Return ONLY a JSON array of query strings, no explanation. Example format:
["query1", "query2", "query3"]`

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a research query generator. Return only valid JSON arrays of search queries.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || "[]"

    console.log("[v0] [GROQ] Generated queries response:", content)

    const cleanContent = extractJSON(content)
    const queries = JSON.parse(cleanContent) as string[]

    console.log("[v0] [GROQ] Generated", queries.length, "queries")

    return queries
  } catch (error) {
    console.error("[v0] [GROQ] Error generating queries:", error)
    // Fallback to basic queries if AI generation fails
    return QUERY_CATEGORIES.flatMap((cat) => cat.queries.map((q) => `${companyName} ${q}`))
  }
}

/**
 * Search Brave Search API
 */
async function searchBrave(query: string): Promise<BraveSearchResult[]> {
  console.log("[v0] [BRAVE] Searching:", query)

  const apiKey = process.env.BRAVE_API_KEY

  if (!apiKey) {
    console.error("[v0] BRAVE_API_KEY environment variable is not set")
    throw new Error("BRAVE_API_KEY environment variable is not set")
  }

  try {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=5`

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] [BRAVE] API error:", response.status, errorText)
      throw new Error(`Brave Search API error: ${response.status}`)
    }

    const data = (await response.json()) as BraveWebResult

    const results = data.web?.results || []

    console.log("[v0] [BRAVE] Search completed for:", query, "- Found", results.length, "results")

    return results
  } catch (error) {
    console.error("[v0] [BRAVE] Error searching:", error)
    return []
  }
}

/**
 * Analyze search results using Groq AI and format into comprehensive research
 */
async function analyzeWithGroq(
  companyName: string,
  searchResults: Array<{ query: string; results: BraveSearchResult[] }>,
): Promise<CompanyResearchData> {
  console.log("[v0] [GROQ] Analyzing", searchResults.length, "search results")

  const apiKey = process.env.API_KEY_GROQ_API_KEY

  if (!apiKey) {
    throw new Error("API_KEY_GROQ_API_KEY environment variable is not set")
  }

  // Prepare the data for analysis
  const resultsText = searchResults
    .map((result) => {
      const { query, results } = result
      let text = `\n### Query: ${query}\n`

      if (results && results.length > 0) {
        text += "Results:\n"
        results.slice(0, 5).forEach((item, index) => {
          text += `${index + 1}. ${item.title}\n`
          text += `   URL: ${item.url}\n`
          text += `   Description: ${item.description}\n\n`
        })
      } else {
        text += "No results found\n"
      }

      return text
    })
    .join("\n")

  const prompt = `You are a business intelligence analyst. Analyze the following search results about "${companyName}" and create a comprehensive, well-structured company research report.

Search Results:
${resultsText}

Create a detailed research report with the following sections:

1. **Company Overview**: Core business, products/services, and mission
2. **Industry Position**: Market position, competitors, and differentiation
3. **Financial Information**: Funding, revenue, and financial performance
4. **Recent News & Updates**: Latest announcements, partnerships, and developments
5. **Key Insights**: Important takeaways and strategic analysis

Format the response as a JSON object with this structure:
{
  "summary": "2-3 sentence executive summary",
  "categories": [
    {
      "category": "Company Overview",
      "content": "Detailed content here",
      "sources": ["source1", "source2"]
    },
    {
      "category": "Industry Position", 
      "content": "Detailed content here",
      "sources": ["source1", "source2"]
    }
  ]
}

Focus on factual information from the search results. If information is limited, acknowledge it. Be concise but comprehensive.`

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a business intelligence analyst. Create comprehensive company research reports from search data. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || "{}"

    console.log("[v0] [GROQ] Analysis completed")

    const cleanContent = extractJSON(content)
    const analysis = JSON.parse(cleanContent)

    return {
      companyName,
      summary: analysis.summary || "No summary available",
      categories: analysis.categories || [],
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[v0] [GROQ] Error analyzing results:", error)

    // Return basic structure if analysis fails
    return {
      companyName,
      summary: `Research data for ${companyName} has been collected but could not be fully analyzed.`,
      categories: [
        {
          category: "Research Data",
          content: "Search results were collected but analysis encountered an error. Please try again.",
          sources: [],
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const REGISTRY_MAP: Record<string, { name: string; searchUrl: string; keywords: string[] }> = {
  US: {
    name: "SEC EDGAR",
    searchUrl: "https://www.sec.gov/edgar/searchedgar/companysearch.html",
    keywords: ["SEC filing", "EDGAR", "securities exchange commission"],
  },
  UK: {
    name: "Companies House",
    searchUrl: "https://find-and-update.company-information.service.gov.uk/",
    keywords: ["Companies House", "UK company registration", "company number UK"],
  },
  EU: {
    name: "OpenCorporates",
    searchUrl: "https://opencorporates.com/",
    keywords: ["OpenCorporates", "European company registry", "EU business registration"],
  },
  UAE: {
    name: "Dubai DED / ADGM",
    searchUrl: "https://www.adgm.com/",
    keywords: ["Dubai DED", "ADGM", "UAE business license"],
  },
  ZA: {
    name: "CIPC",
    searchUrl: "https://eservices.cipc.co.za/",
    keywords: ["CIPC", "South Africa company registration", "Companies and Intellectual Property Commission"],
  },
  SG: {
    name: "ACRA",
    searchUrl: "https://www.acra.gov.sg/",
    keywords: ["ACRA", "Singapore company registration", "Accounting and Corporate Regulatory Authority"],
  },
  IN: {
    name: "Ministry of Corporate Affairs",
    searchUrl: "https://www.mca.gov.in/",
    keywords: ["MCA India", "CIN", "Indian company registration"],
  },
  CA: {
    name: "Corporations Canada",
    searchUrl: "https://www.ic.gc.ca/eic/site/cd-dgc.nsf/eng/home",
    keywords: ["Corporations Canada", "Canadian business number", "corporate registry Canada"],
  },
  AU: {
    name: "ASIC",
    searchUrl: "https://asic.gov.au/",
    keywords: ["ASIC", "Australian company", "ABN", "ACN"],
  },
}

/**
 * Detect country from company domain, location data, or online sources
 */
async function detectCountry(companyName: string, companyDomain?: string): Promise<string> {
  console.log("[v0] [REGISTRY] Detecting country for:", companyName)

  // First try: Domain TLD analysis
  if (companyDomain) {
    const tldMap: Record<string, string> = {
      ".uk": "UK",
      ".co.uk": "UK",
      ".ae": "UAE",
      ".za": "ZA",
      ".sg": "SG",
      ".in": "IN",
      ".ca": "CA",
      ".au": "AU",
      ".de": "EU",
      ".fr": "EU",
      ".it": "EU",
      ".es": "EU",
    }

    for (const [tld, country] of Object.entries(tldMap)) {
      if (companyDomain.endsWith(tld)) {
        console.log("[v0] [REGISTRY] Country detected from domain TLD:", country)
        return country
      }
    }
  }

  // Second try: Use Brave Search to find country information
  try {
    const query = `${companyName} company headquarters location country`
    const results = await searchBrave(query)

    if (results.length > 0) {
      const text = results
        .slice(0, 3)
        .map((r) => `${r.title} ${r.description}`)
        .join(" ")
        .toLowerCase()

      // Check for country mentions
      const countryKeywords: Record<string, string[]> = {
        US: ["united states", "usa", "delaware", "california", "new york", "american"],
        UK: ["united kingdom", "uk", "britain", "england", "london", "british"],
        UAE: ["dubai", "abu dhabi", "uae", "emirates"],
        SG: ["singapore"],
        IN: ["india", "mumbai", "bangalore", "delhi"],
        CA: ["canada", "toronto", "vancouver"],
        AU: ["australia", "sydney", "melbourne"],
        ZA: ["south africa", "johannesburg", "cape town"],
        EU: ["germany", "france", "netherlands", "belgium", "spain", "italy"],
      }

      for (const [country, keywords] of Object.entries(countryKeywords)) {
        if (keywords.some((keyword) => text.includes(keyword))) {
          console.log("[v0] [REGISTRY] Country detected from search:", country)
          return country
        }
      }
    }
  } catch (error) {
    console.error("[v0] [REGISTRY] Error detecting country:", error)
  }

  // Default to US if unable to detect
  console.log("[v0] [REGISTRY] Defaulting to US")
  return "US"
}

/**
 * Fetch corporate registry data for a company
 */
export async function fetchRegistryData(
  companyName: string,
  companyDomain?: string,
): Promise<CorporateRegistryData | null> {
  console.log("[v0] [REGISTRY] Fetching registry data for:", companyName)

  try {
    // Step 1: Detect country
    const country = await detectCountry(companyName, companyDomain)
    const registry = REGISTRY_MAP[country] || REGISTRY_MAP.US

    console.log("[v0] [REGISTRY] Using registry:", registry.name, "for country:", country)

    // Step 2: Search for company registration information
    await sleep(1200) // Rate limiting
    const queries = [
      `${companyName} ${registry.keywords[0]} registration number`,
      `${companyName} ${registry.keywords[1]} incorporation date`,
      `${companyName} company directors officers`,
      `${companyName} shareholders ownership structure`,
    ]

    const searchResults: BraveSearchResult[] = []

    for (const query of queries) {
      const results = await searchBrave(query)
      searchResults.push(...results)
      await sleep(1200)
    }

    console.log("[v0] [REGISTRY] Collected", searchResults.length, "search results")

    // Step 3: Use Groq AI to extract structured registry data
    const apiKey = process.env.API_KEY_GROQ_API_KEY
    if (!apiKey) {
      throw new Error("API_KEY_GROQ_API_KEY not set")
    }

    const resultsText = searchResults
      .slice(0, 15)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.description}\n   ${r.url}\n`)
      .join("\n")

    const prompt = `You are analyzing corporate registry information for "${companyName}". 
    
Search Results:
${resultsText}

Extract the following information and return ONLY a JSON object:
{
  "company_name": "official legal name",
  "registry_name": "${registry.name}",
  "registry_url": "${registry.searchUrl}",
  "registration_id": "registration/company number if found",
  "date_of_incorporation": "date if found, or 'Not available'",
  "status": "Active/Dissolved/etc or 'Not available'",
  "directors": ["list of directors/officers if found"],
  "major_shareholders": ["list of major shareholders if found"],
  "financials_summary": "summary of financial filings if available, or 'Not publicly available'",
  "source_url": "most relevant source URL from search results"
}

If information is not found in the search results, use "Not available" or empty arrays. Be factual and only include information present in the results.`

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Extract corporate registry information from search results. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || "{}"
    const cleanContent = extractJSON(content)
    const registryData = JSON.parse(cleanContent)

    console.log("[v0] [REGISTRY] Successfully extracted registry data")

    return {
      ...registryData,
      country,
    }
  } catch (error) {
    console.error("[v0] [REGISTRY] Error fetching registry data:", error)
    return null
  }
}

export interface CompanyResearchData {
  companyName: string
  summary: string
  categories: Array<{
    category: string
    content: string
    sources: string[]
  }>
  generatedAt: string
  registryData?: CorporateRegistryData | null
}

/**
 * Main research function: Generate queries → Search Brave → Analyze with Groq
 */
export async function researchCompanyWithGroqBrave(
  companyName: string,
  companyDomain?: string,
): Promise<CompanyResearchData> {
  console.log("[v0] Starting Groq+Brave research for:", companyName)

  try {
    const [queries, registryData] = await Promise.all([
      generateSearchQueries(companyName),
      fetchRegistryData(companyName, companyDomain),
    ])

    // Step 2: Search Brave for each query with rate limiting (1 request per second for free plan)
    const searchResults: Array<{ query: string; results: BraveSearchResult[] }> = []

    // Limit to 8 queries to avoid excessive API calls
    const limitedQueries = queries.slice(0, 8)

    for (const query of limitedQueries) {
      const results = await searchBrave(query)
      searchResults.push({ query, results })

      // Wait 1.2 seconds between requests to respect free plan rate limit (1 req/sec)
      if (searchResults.length < limitedQueries.length) {
        await sleep(1200)
      }
    }

    console.log("[v0] Completed", searchResults.length, "searches")

    // Step 3: Analyze results with Groq and format the response
    const analysis = await analyzeWithGroq(companyName, searchResults)

    console.log("[v0] Research completed successfully for:", companyName)

    return {
      ...analysis,
      registryData,
    }
  } catch (error) {
    console.error("[v0] Error in research process:", error)
    throw error
  }
}
