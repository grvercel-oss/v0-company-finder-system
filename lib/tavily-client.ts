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
    // Perform 5 parallel searches for different aspects
    const [funding, investors, financial, news, overview] = await Promise.all([
      searchWithTavily(`${companyName} funding rounds Series A B C venture capital`, 5),
      searchWithTavily(`${companyName} investors backers venture capital firms`, 5),
      searchWithTavily(`${companyName} revenue valuation financial metrics ARR MRR`, 5),
      searchWithTavily(`${companyName} recent news announcements 2024 2025`, 5),
      searchWithTavily(`${companyName} company overview products services business model`, 5),
    ])

    console.log("[v0] [Tavily] Completed all searches")

    return { funding, investors, financial, news, overview }
  } catch (error) {
    console.error("[v0] [Tavily] Comprehensive search error:", error)
    throw error
  }
}
