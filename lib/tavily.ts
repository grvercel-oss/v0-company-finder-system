export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
  raw_content: string | null
}

export interface TavilySearchResponse {
  query: string
  answer: string
  images: string[]
  results: TavilySearchResult[]
}

export async function searchCompanyWithTavily(
  companyName: string,
  companyDomain?: string,
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY environment variable is not set")
  }

  // Construct a comprehensive query for company research
  const query = companyDomain
    ? `${companyName} ${companyDomain} company information latest news products services`
    : `${companyName} company information latest news products services`

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: true,
      include_raw_content: false,
      max_results: 5,
      include_domains: companyDomain ? [companyDomain] : undefined,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Tavily API error: ${response.status} - ${error}`)
  }

  return response.json()
}
