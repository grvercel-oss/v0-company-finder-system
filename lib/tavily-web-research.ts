import { trackAIUsage } from "./ai-cost-tracker"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.NEON_DATABASE_URL!)

interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
  published_date?: string
}

interface TavilyResponse {
  results: TavilySearchResult[]
}

interface NewsArticle {
  title: string
  url: string
  source: string
  date: string
  category?: string
}

interface EmployeeDataPoint {
  date: string
  count: number
  source: string
  source_url: string
}

interface CompanyResearchData {
  companyName: string
  summary: string
  employee_count: number | null
  employee_history: EmployeeDataPoint[]
  employee_growth_6mo: number | null
  employee_growth_yoy: number | null
  founded_year: number | null
  revenue_estimate: string | null
  ownership: string | null
  news_articles: NewsArticle[]
  funding_rounds: Array<{
    round_type: string
    amount_usd: number
    announced_date: string
    lead_investors: string[]
    source_url: string
  }>
  total_funding: number
  all_investors: string[]
  generatedAt: string
}

/**
 * Search Tavily for company information
 */
async function searchTavily(
  query: string,
  searchDepth: "basic" | "advanced" = "advanced",
): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY

  if (!apiKey) {
    console.error("[Tavily] API key not found")
    return []
  }

  try {
    console.log(`[Tavily] Searching for: ${query}`)

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: searchDepth,
        include_domains: [
          "linkedin.com",
          "crunchbase.com",
          "techcrunch.com",
          "bloomberg.com",
          "reuters.com",
          "forbes.com",
          "businessinsider.com",
          "theinformation.com",
          "venturebeat.com",
          "pitchbook.com",
        ],
        max_results: 10,
      }),
    })

    if (!response.ok) {
      console.error(`[Tavily] API error: ${response.status}`)
      return []
    }

    const data: TavilyResponse = await response.json()
    console.log(`[Tavily] Found ${data.results?.length || 0} results`)

    return data.results || []
  } catch (error) {
    console.error("[Tavily] Search error:", error)
    return []
  }
}

/**
 * Extract employee count from text using patterns
 */
function extractEmployeeCount(text: string): number | null {
  const patterns = [
    /(\d{1,5})\s*(?:employees|staff|team members|people)/i,
    /headcount.*?(\d{1,5})/i,
    /team.*?(\d{1,5})\s*people/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const count = Number.parseInt(match[1], 10)
      if (count > 0 && count < 1000000) {
        return count
      }
    }
  }

  return null
}

/**
 * Extract date from text or source
 */
function extractDate(text: string, publishedDate?: string): string {
  if (publishedDate) {
    return publishedDate
  }

  const patterns = [
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+20\d{2}/i,
    /\d{1,2}\/\d{1,2}\/20\d{2}/,
    /20\d{2}-\d{2}-\d{2}/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return new Date(match[0]).toISOString().split("T")[0]
    }
  }

  return new Date().toISOString().split("T")[0]
}

/**
 * Research company using Tavily web search
 */
export async function researchCompanyWithTavily(companyName: string, accountId: string): Promise<CompanyResearchData> {
  console.log(`[Tavily Research] Starting research for: ${companyName}`)

  const result: CompanyResearchData = {
    companyName,
    summary: "",
    employee_count: null,
    employee_history: [],
    employee_growth_6mo: null,
    employee_growth_yoy: null,
    founded_year: null,
    revenue_estimate: null,
    ownership: null,
    news_articles: [],
    funding_rounds: [],
    total_funding: 0,
    all_investors: [],
    generatedAt: new Date().toISOString(),
  }

  try {
    // Parallel searches for different data types
    const [employeeResults, fundingResults, newsResults, companyInfoResults] = await Promise.all([
      searchTavily(`${companyName} employees headcount team size 2024 2025`),
      searchTavily(`${companyName} funding Series A B C D investment valuation 2024 2025`),
      searchTavily(`${companyName} news 2024 2025`),
      searchTavily(`${companyName} company overview founded revenue`),
    ])

    // Extract employee data from results
    const employeeDataPoints: EmployeeDataPoint[] = []
    for (const result of employeeResults) {
      const count = extractEmployeeCount(result.content + " " + result.title)
      if (count) {
        employeeDataPoints.push({
          date: extractDate(result.content, result.published_date),
          count,
          source: new URL(result.url).hostname.replace("www.", ""),
          source_url: result.url,
        })
      }
    }

    // Sort by date and get latest
    employeeDataPoints.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (employeeDataPoints.length > 0) {
      result.employee_count = employeeDataPoints[0].count
      result.employee_history = employeeDataPoints.slice(0, 10) // Keep top 10 data points
    }

    // Extract news articles
    result.news_articles = newsResults
      .map((item) => ({
        title: item.title,
        url: item.url,
        source: new URL(item.url).hostname.replace("www.", ""),
        date: extractDate(item.content, item.published_date),
        category: undefined, // Could use AI to categorize
      }))
      .slice(0, 20) // Keep top 20 news articles

    // Extract funding information
    const investorSet = new Set<string>()
    for (const result of fundingResults) {
      const content = result.content + " " + result.title

      // Extract funding round type
      const roundMatch = content.match(/(Seed|Series [A-F]|Series [A-F]\d?)/i)
      if (roundMatch) {
        // Extract amount
        const amountMatch = content.match(/\$(\d+(?:\.\d+)?)\s*(million|billion|M|B)/i)
        if (amountMatch) {
          const amount = Number.parseFloat(amountMatch[1])
          const multiplier = amountMatch[2].toLowerCase().startsWith("b") ? 1000000000 : 1000000

          result.funding_rounds.push({
            round_type: roundMatch[1],
            amount_usd: amount * multiplier,
            announced_date: extractDate(content, result.published_date),
            lead_investors: [], // Extract if found
            source_url: result.url,
          })
        }
      }

      // Extract investor names
      const investorPattern =
        /(?:led by|investor|backed by|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Capital|Ventures|Partners|Equity|Fund))?)/g
      let match
      while ((match = investorPattern.exec(content)) !== null) {
        investorSet.add(match[1].trim())
      }
    }

    result.all_investors = Array.from(investorSet).slice(0, 20)
    result.total_funding = result.funding_rounds.reduce((sum, round) => sum + round.amount_usd, 0)

    // Extract company info
    for (const item of companyInfoResults) {
      const content = item.content + " " + item.title

      // Extract founded year
      if (!result.founded_year) {
        const foundedMatch = content.match(/founded\s+in\s+(19\d{2}|20\d{2})/i)
        if (foundedMatch) {
          result.founded_year = Number.parseInt(foundedMatch[1], 10)
        }
      }

      // Extract revenue
      if (!result.revenue_estimate) {
        const revenueMatch = content.match(/revenue.*?\$(\d+(?:\.\d+)?)\s*(million|billion|M|B)/i)
        if (revenueMatch) {
          result.revenue_estimate = `$${revenueMatch[1]}${revenueMatch[2]}`
        }
      }

      // Extract ownership
      if (!result.ownership) {
        if (content.match(/private\s+company/i)) {
          result.ownership = "Private"
        } else if (content.match(/public\s+company|traded/i)) {
          result.ownership = "Public"
        }
      }
    }

    // Generate summary
    result.summary = `${companyName}${result.founded_year ? ` (founded ${result.founded_year})` : ""} is a ${result.ownership || "company"}${result.employee_count ? ` with approximately ${result.employee_count} employees` : ""}${result.revenue_estimate ? ` generating ${result.revenue_estimate} in revenue` : ""}. ${result.total_funding > 0 ? `The company has raised $${(result.total_funding / 1000000).toFixed(1)}M in total funding` : "Funding information not available"}.`

    console.log(`[Tavily Research] Research completed for ${companyName}`)
    console.log(
      `[Tavily Research] Found: ${result.employee_history.length} employee data points, ${result.news_articles.length} news articles, ${result.funding_rounds.length} funding rounds`,
    )

    // Track API usage (Tavily costs $0.002 per search)
    const searchCount = 4 // We made 4 parallel searches
    await trackAIUsage({
      sql,
      accountId,
      model: "tavily-search",
      promptTokens: 0,
      completionTokens: searchCount,
      generationType: "web_search",
    })

    return result
  } catch (error) {
    console.error("[Tavily Research] Error:", error)
    result.summary = `Unable to complete research for ${companyName}. ${error instanceof Error ? error.message : "Unknown error"}`
    return result
  }
}
