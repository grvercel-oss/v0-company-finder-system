// Enhanced funding and financial research using Groq + Common Crawl

interface FundingRound {
  round_type: string
  amount_usd: number
  currency: string
  announced_date: string
  lead_investors: string[]
  other_investors: string[]
  post_money_valuation?: number
  source_url: string
  confidence_score: number
}

interface FinancialMetrics {
  fiscal_year: number
  fiscal_quarter?: number
  revenue?: number
  profit?: number
  revenue_growth_pct?: number
  user_count?: number
  arr?: number
  mrr?: number
  source: string
  source_url: string
  confidence_score: number
}

export interface CompanyFundingData {
  companyName: string
  funding_rounds: FundingRound[]
  total_funding: number
  latest_valuation?: number
  financial_metrics: FinancialMetrics[]
  all_investors: string[]
  generatedAt: string
}

/**
 * Extract JSON from Groq response
 */
function extractJSON(content: string): string {
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    return jsonMatch[1].trim()
  }
  return content.trim()
}

/**
 * Search for funding information using Brave Search
 */
async function searchFundingInfo(companyName: string): Promise<string> {
  const apiKey = process.env.BRAVE_API_KEY
  if (!apiKey) throw new Error("BRAVE_API_KEY not set")

  const queries = [
    `${companyName} funding rounds series A B C investors`,
    `${companyName} valuation investment raised`,
    `${companyName} revenue profit financial performance`,
    `${companyName} investors venture capital funding history`,
  ]

  let allResults = ""

  for (const query of queries) {
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

      if (response.ok) {
        const data = await response.json()
        const results = data.web?.results || []

        results.forEach((result: any) => {
          allResults += `\nTitle: ${result.title}\nURL: ${result.url}\nDescription: ${result.description}\n`
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 1200))
    } catch (error) {
      console.error("[v0] [Funding Research] Error searching:", error)
    }
  }

  return allResults
}

/**
 * Search Common Crawl for funding and investor pages
 */
async function searchCommonCrawlFunding(domain: string): Promise<string> {
  try {
    const indexResponse = await fetch("https://index.commoncrawl.org/collinfo.json")
    if (!indexResponse.ok) return ""

    const collections = await indexResponse.json()
    const latestIndex = collections[0]?.["cdx-api"]
    if (!latestIndex) return ""

    const paths = ["funding", "investors", "about", "press", "news"]
    let extractedContent = ""

    for (const path of paths) {
      try {
        const searchUrl = `${latestIndex}?url=${domain}/${path}*&output=json&limit=2`
        const response = await fetch(searchUrl)

        if (response.ok) {
          const text = await response.text()
          const lines = text.trim().split("\n")

          for (const line of lines.slice(0, 2)) {
            try {
              const record = JSON.parse(line)
              if (record.status === "200") {
                extractedContent += `Found ${path} page at ${record.url}\n`
              }
            } catch (e) {
              // Skip invalid lines
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error("[v0] [CC Funding] Error:", error)
      }
    }

    return extractedContent
  } catch (error) {
    console.error("[v0] [CC Funding] Error:", error)
    return ""
  }
}

/**
 * Analyze funding data with Groq AI
 */
async function analyzeFundingWithGroq(
  companyName: string,
  searchResults: string,
  ccResults: string,
): Promise<CompanyFundingData> {
  const apiKey = process.env.API_KEY_GROQ_API_KEY
  if (!apiKey) throw new Error("API_KEY_GROQ_API_KEY not set")

  const prompt = `You are a financial analyst extracting funding and investment data for "${companyName}".

Search Results:
${searchResults}

Common Crawl Findings:
${ccResults}

Extract and structure ALL funding information into JSON format:

{
  "companyName": "${companyName}",
  "funding_rounds": [
    {
      "round_type": "Series A/B/C/Seed/etc",
      "amount_usd": 0.0,
      "currency": "USD",
      "announced_date": "YYYY-MM-DD",
      "lead_investors": ["investor names"],
      "other_investors": ["investor names"],
      "post_money_valuation": 0.0,
      "source_url": "url",
      "confidence_score": 85
    }
  ],
  "total_funding": 0.0,
  "latest_valuation": 0.0,
  "financial_metrics": [
    {
      "fiscal_year": 2024,
      "revenue": 0.0,
      "profit": 0.0,
      "revenue_growth_pct": 0.0,
      "user_count": 0,
      "arr": 0.0,
      "mrr": 0.0,
      "source": "News/SEC/Company",
      "source_url": "url",
      "confidence_score": 85
    }
  ],
  "all_investors": ["unique list of all investors"],
  "generatedAt": "${new Date().toISOString()}"
}

Rules:
- Extract ONLY factual information from the search results
- Include confidence_score (0-100) based on source reliability
- If no data found, return empty arrays
- Convert all amounts to USD numbers (no $, M, B suffixes)
- Parse "$50M" as 50000000, "$2B" as 2000000000
- Return ONLY valid JSON, no explanations`

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
            content: "You are a financial data extraction expert. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) throw new Error(`Groq API error: ${response.status}`)

    const data = await response.json()
    const content = data.choices[0]?.message?.content || "{}"
    const cleanContent = extractJSON(content)
    const fundingData = JSON.parse(cleanContent)

    return fundingData
  } catch (error) {
    console.error("[v0] [Funding Analysis] Error:", error)
    return {
      companyName,
      funding_rounds: [],
      total_funding: 0,
      financial_metrics: [],
      all_investors: [],
      generatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Main function: Research company funding and financials
 */
export async function researchCompanyFunding(companyName: string, companyDomain?: string): Promise<CompanyFundingData> {
  console.log("[v0] [Funding Research] Starting for:", companyName)

  try {
    const searchResults = await searchFundingInfo(companyName)
    console.log("[v0] [Funding Research] Search results length:", searchResults.length)

    let ccResults = ""
    if (companyDomain) {
      ccResults = await searchCommonCrawlFunding(companyDomain)
      console.log("[v0] [Funding Research] CC results length:", ccResults.length)
    }

    const fundingData = await analyzeFundingWithGroq(companyName, searchResults, ccResults)

    console.log("[v0] [Funding Research] Completed. Found", fundingData.funding_rounds.length, "funding rounds")

    return fundingData
  } catch (error) {
    console.error("[v0] [Funding Research] Error:", error)
    throw error
  }
}
