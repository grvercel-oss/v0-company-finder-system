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
  results: BraveSearchResult[]
  query: {
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

export interface CompanyResearchData {
  companyName: string
  summary: string
  categories: Array<{
    category: string
    content: string
    sources: string[]
  }>
  generatedAt: string
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

    console.log("[v0] [BRAVE] Search completed for:", query, "- Found", data.results?.length || 0, "results")

    return data.results || []
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
 * Main research function: Generate queries → Search Brave → Analyze with Groq
 */
export async function researchCompanyWithGroqBrave(
  companyName: string,
  companyDomain?: string,
): Promise<CompanyResearchData> {
  console.log("[v0] Starting Groq+Brave research for:", companyName)

  try {
    // Step 1: Generate search queries using Groq
    const queries = await generateSearchQueries(companyName)

    // Step 2: Search Brave for each query (limit to 10)
    const searchPromises = queries.slice(0, 10).map(async (query) => ({
      query,
      results: await searchBrave(query),
    }))

    const searchResults = await Promise.all(searchPromises)

    console.log("[v0] Completed", searchResults.length, "searches")

    // Step 3: Analyze results with Groq and format the response
    const analysis = await analyzeWithGroq(companyName, searchResults)

    console.log("[v0] Research completed successfully for:", companyName)

    return analysis
  } catch (error) {
    console.error("[v0] Error in research process:", error)
    throw error
  }
}
