// Tavily Search API Client
// Provides real-time web search for company research

export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
  published_date?: string
}

export interface TavilySearchResponse {
  query: string
  results: TavilySearchResult[]
  answer?: string
  response_time: number
}

/**
 * Search the web using Tavily API
 */
export async function searchWithTavily(query: string, maxResults = 5): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY environment variable is not set")
  }

  console.log("[v0] [Tavily] Searching:", query)

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "advanced", // Use advanced search for better results
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
        include_domains: [],
        exclude_domains: [],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] [Tavily] API Error:", response.status, errorText)
      throw new Error(`Tavily API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    console.log("[v0] [Tavily] Found", data.results?.length || 0, "results")

    return {
      query: query,
      results: (data.results || []).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || "",
        score: r.score || 0,
        published_date: r.published_date,
      })),
      answer: data.answer,
      response_time: data.response_time || 0,
    }
  } catch (error) {
    console.error("[v0] [Tavily] Search error:", error)
    throw error
  }
}

/**
 * Perform multiple parallel searches for comprehensive company research
 */
export async function searchCompanyWithTavily(companyName: string): Promise<{
  funding: TavilySearchResponse
  investors: TavilySearchResponse
  financial: TavilySearchResponse
  news: TavilySearchResponse
  overview: TavilySearchResponse
}> {
  console.log("[v0] [Tavily] Starting comprehensive search for:", companyName)

  try {
    const [funding, investors, financial, news, overview] = await Promise.all([
      // Search for funding with specific round types and financial news sources
      searchWithTavily(
        `"${companyName}" funding round "Series A" OR "Series B" OR "Series C" OR "seed round" OR "raised" million`,
        10,
      ),
      // Search for investor information
      searchWithTavily(`"${companyName}" investors OR backers OR "led by" OR "participated" venture capital`, 10),
      // Search for financial metrics and valuation
      searchWithTavily(
        `"${companyName}" revenue OR valuation OR ARR OR MRR OR "annual recurring revenue" financial metrics`,
        10,
      ),
      // Search for recent news with date focus
      searchWithTavily(`"${companyName}" news OR announcement OR launch OR partnership 2024 OR 2025`, 10),
      // Search for company overview
      searchWithTavily(`"${companyName}" company overview OR about OR products OR services OR business model`, 10),
    ])

    console.log("[v0] [Tavily] Completed all searches")
    console.log("[v0] [Tavily] Funding results:", funding.results.length)
    console.log("[v0] [Tavily] Investors results:", investors.results.length)
    console.log("[v0] [Tavily] Financial results:", financial.results.length)
    console.log("[v0] [Tavily] News results:", news.results.length)
    console.log("[v0] [Tavily] Overview results:", overview.results.length)

    return { funding, investors, financial, news, overview }
  } catch (error) {
    console.error("[v0] [Tavily] Comprehensive search error:", error)
    throw error
  }
}
