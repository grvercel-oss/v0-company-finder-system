interface NewsArticle {
  title: string
  description: string
  content: string
  url: string
  publishedAt: string
  source: {
    name: string
  }
}

interface NewsAPIResponse {
  status: string
  totalResults: number
  articles: NewsArticle[]
}

export async function searchCompanyNews(
  companyName: string,
  keywords: string[] = ["funding", "investment", "valuation", "revenue", "investors"],
): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWS_API_KEY

  if (!apiKey) {
    console.log("[v0] [News API] No API key found, skipping news search")
    return []
  }

  try {
    const query = `"${companyName}" OR "${companyName} Inc" OR "${companyName} Ltd" OR "${companyName} startup" OR "${companyName}.com" OR "${companyName}.ai"`

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const fromDate = thirtyDaysAgo.toISOString().split("T")[0]

    const params = new URLSearchParams({
      q: query,
      from: fromDate,
      sortBy: "relevancy",
      language: "en",
      pageSize: "10",
      apiKey: apiKey,
    })

    const url = `https://newsapi.org/v2/everything?${params.toString()}`

    console.log("[v0] [News API] Request URL:", url.replace(apiKey, "***API_KEY***"))

    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] [News API] Error:", error)
      return []
    }

    const data: NewsAPIResponse = await response.json()
    console.log(
      `[v0] [News API] Found ${data.totalResults} total results, received ${data.articles?.length || 0} articles`,
    )

    if (!data.articles || data.articles.length === 0) {
      console.log(`[v0] [News API] No recent news found for '${companyName}'`)
      return []
    }

    const companyNameLower = companyName.trim().toLowerCase()
    const filteredArticles = data.articles.filter((article) => {
      const titleMatch = article.title?.toLowerCase().includes(companyNameLower)
      const descMatch = article.description?.toLowerCase().includes(companyNameLower)
      return titleMatch || descMatch
    })

    console.log(`[v0] [News API] After filtering: ${filteredArticles.length} articles mention company name`)

    if (filteredArticles.length === 0) {
      console.log(`[v0] [News API] No recent news found for '${companyName}' (after filtering)`)
      return []
    }

    // Filter out articles without content
    const articlesWithContent = filteredArticles.filter((article) => article.content && article.content.length > 100)

    console.log(`[v0] [News API] Using ${articlesWithContent.length} articles with content`)

    return articlesWithContent
  } catch (error) {
    console.error("[v0] [News API] Search error:", error)
    return []
  }
}

export function extractTextFromArticles(articles: NewsArticle[]): string {
  // Combine articles into a single text corpus for Groq to analyze
  return articles
    .map((article) => {
      return `
Source: ${article.source.name}
Date: ${article.publishedAt}
Title: ${article.title}
Content: ${article.description || ""} ${article.content || ""}
URL: ${article.url}
---
`
    })
    .join("\n")
}
