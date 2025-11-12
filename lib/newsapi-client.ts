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
    const searchStrategies = [
      // Strategy 1: Company name with OR keywords (broader)
      `"${companyName}" AND (${keywords.slice(0, 5).join(" OR ")})`,
      // Strategy 2: Just company name (even broader)
      `"${companyName}"`,
      // Strategy 3: Company name without quotes + funding keywords
      `${companyName} (funding OR investment OR raised)`,
    ]

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const fromDate = thirtyDaysAgo.toISOString().split("T")[0]

    let allArticles: NewsArticle[] = []

    // Try each search strategy until we get results
    for (const [index, query] of searchStrategies.entries()) {
      console.log(`[v0] [News API] Search attempt ${index + 1}: ${query}`)

      const params = new URLSearchParams({
        q: query,
        from: fromDate,
        sortBy: "relevancy",
        language: "en",
        pageSize: "20",
        apiKey: apiKey,
      })

      const response = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`)

      if (!response.ok) {
        const error = await response.text()
        console.error(`[v0] [News API] Error on attempt ${index + 1}: ${error}`)
        continue // Try next strategy
      }

      const data: NewsAPIResponse = await response.json()
      console.log(`[v0] [News API] Attempt ${index + 1} found ${data.totalResults} articles`)

      if (data.articles && data.articles.length > 0) {
        allArticles = data.articles
        break // Found articles, stop trying other strategies
      }
    }

    if (allArticles.length === 0) {
      console.log("[v0] [News API] No articles found after trying all search strategies")
      return []
    }

    // Filter out articles without content
    const articlesWithContent = allArticles.filter((article) => article.content && article.content.length > 100)

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
