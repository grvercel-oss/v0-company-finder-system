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
    // Build search query
    const query = `"${companyName}" AND (${keywords.join(" OR ")})`

    // Search last 6 months of news
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const params = new URLSearchParams({
      q: query,
      from: sixMonthsAgo.toISOString().split("T")[0],
      sortBy: "relevancy",
      language: "en",
      pageSize: "20", // Get top 20 articles
      apiKey: apiKey,
    })

    console.log(`[v0] [News API] Searching for: ${companyName}`)

    const response = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`)

    if (!response.ok) {
      const error = await response.text()
      console.error(`[v0] [News API] Error: ${error}`)
      return []
    }

    const data: NewsAPIResponse = await response.json()

    console.log(`[v0] [News API] Found ${data.totalResults} articles`)

    // Filter out articles without content
    const articles = data.articles.filter((article) => article.content && article.content.length > 100)

    console.log(`[v0] [News API] Using ${articles.length} articles with content`)

    return articles
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
