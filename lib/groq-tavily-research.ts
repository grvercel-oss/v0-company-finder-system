// Groq AI + Tavily Web Search Integration
// Uses Tavily for real web data, Groq for analysis

import Groq from "groq-sdk"
import { searchCompanyWithTavily } from "./tavily-client"

const groq = new Groq({ apiKey: process.env.API_KEY_GROQ_API_KEY })

export interface CompanyResearchData {
  companyName: string
  summary: string
  categories: Array<{
    category: string
    content: string
    sources: string[]
  }>
  generatedAt: string
  funding?: {
    companyName: string
    funding_rounds: Array<{
      round_type: string
      amount_usd: number
      currency: string
      announced_date: string
      lead_investors: string[]
      other_investors: string[]
      post_money_valuation?: number
      source_url: string
      confidence_score: number
    }>
    total_funding: number
    latest_valuation?: number
    financial_metrics: Array<{
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
    }>
    all_investors: string[]
    generatedAt: string
  }
}

function cleanText(text: string): string {
  if (!text || typeof text !== "string") return ""

  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .trim()
}

function deepCleanObject(obj: any): any {
  if (typeof obj === "string") {
    return cleanText(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(deepCleanObject)
  }
  if (obj && typeof obj === "object") {
    const cleaned: any = {}
    for (const key in obj) {
      cleaned[key] = deepCleanObject(obj[key])
    }
    return cleaned
  }
  return obj
}

/**
 * Research company using Tavily search + Groq analysis
 */
export async function researchCompanyWithTavilyAndGroq(companyName: string): Promise<CompanyResearchData> {
  console.log("[v0] [Tavily+Groq] Starting research for:", companyName)

  try {
    // Step 1: Search the web with Tavily
    console.log("[v0] [Tavily+Groq] Performing web searches...")
    const searchResults = await searchCompanyWithTavily(companyName)

    // Step 2: Compile all search results into context
    const webContext = {
      funding_info: searchResults.funding.results
        .filter((r) => r.score > 0.5)
        .slice(0, 5) // Limit to top 5 results
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 300)}\n`) // Reduced from 800 to 300
        .join("\n---\n"),

      investors_info: searchResults.investors.results
        .filter((r) => r.score > 0.5)
        .slice(0, 5)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 300)}\n`)
        .join("\n---\n"),

      financial_info: searchResults.financial.results
        .filter((r) => r.score > 0.5)
        .slice(0, 5)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 300)}\n`)
        .join("\n---\n"),

      news_info: searchResults.news.results
        .filter((r) => r.score > 0.5)
        .slice(0, 5)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 300)}\n`)
        .join("\n---\n"),

      overview_info: searchResults.overview.results
        .filter((r) => r.score > 0.5)
        .slice(0, 5)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 300)}\n`)
        .join("\n---\n"),
    }

    // Collect all unique source URLs with better filtering
    const allSources = new Set<string>()
    ;[
      searchResults.funding,
      searchResults.investors,
      searchResults.financial,
      searchResults.news,
      searchResults.overview,
    ].forEach((result) => {
      result.results.forEach((r) => {
        if (r.score > 0.5) allSources.add(r.url) // Increased minimum score
      })
    })

    console.log("[v0] [Tavily+Groq] Found", allSources.size, "high-quality sources (score > 0.5)")

    // Step 3: Use Groq to analyze and structure the data
    console.log("[v0] [Tavily+Groq] Analyzing with Groq openai/gpt-oss-20b...")

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content:
            "You are a financial research analyst specializing in extracting precise funding and financial data. Analyze web search results and extract ONLY information explicitly stated in the sources. For funding amounts, extract the exact dollar values mentioned. If specific data is not found, mark it as null. Always preserve source URLs for verification.",
        },
        {
          role: "user",
          content: `Analyze the following web search results about "${companyName}" and extract ALL funding and financial information.

WEB SEARCH RESULTS:

=== FUNDING INFORMATION ===
${webContext.funding_info || "No funding information found"}

=== INVESTORS INFORMATION ===
${webContext.investors_info || "No investor information found"}

=== FINANCIAL INFORMATION ===
${webContext.financial_info || "No financial information found"}

=== RECENT NEWS ===
${webContext.news_info || "No recent news found"}

=== COMPANY OVERVIEW ===
${webContext.overview_info || "No overview information found"}

Extract ALL information in JSON format:

{
  "summary": "3-4 sentence executive summary with key facts about the company, funding, and recent developments",
  "categories": [
    {
      "category": "Recent Funding & Investments",
      "content": "DETAILED analysis (300-500 words) of ALL funding rounds mentioned. For EACH round include: round type (Seed/Series A/B/C/etc), exact amount in millions/billions, date, ALL investors mentioned (lead and participating), and any valuation mentioned. Extract EVERY dollar amount and investor name found in sources. Be comprehensive - don't summarize, include all details.",
      "sources": ["URL1", "URL2"]
    },
    {
      "category": "Financial Performance & Revenue",
      "content": "DETAILED analysis (200-400 words) of revenue, ARR, MRR, profit, growth rates, customer count, and any other financial metrics mentioned. Include specific numbers, dates, and year-over-year comparisons if available.",
      "sources": ["URL1"]
    },
    {
      "category": "Investors & Backers",
      "content": "COMPREHENSIVE list of ALL investors mentioned across all sources. Organize by round if possible. Include venture capital firms, angel investors, strategic investors, and corporate investors.",
      "sources": ["URL1"]
    },
    {
      "category": "Company Overview & Market",
      "content": "What the company does, products/services, target market, competitive advantages, and market position based on sources.",
      "sources": ["URL1"]
    },
    {
      "category": "Recent News & Developments",
      "content": "Recent announcements, product launches, partnerships, acquisitions, leadership changes, or other significant events.",
      "sources": ["URL1"]
    }
  ],
  "funding_data": {
    "funding_rounds": [
      // For EACH funding round mentioned in sources:
      {
        "round_type": "Series C",  // Extract exact round type from source
        "amount_usd": 80000000,    // Convert to USD numeric value (e.g., $80M = 80000000)
        "announced_date": "2024-03-15",  // Extract date in YYYY-MM-DD format
        "lead_investors": ["Lead VC Name"],  // Extract ALL lead investors mentioned
        "other_investors": ["Other VC 1", "Other VC 2"],  // Extract ALL other investors
        "post_money_valuation": 500000000,  // If valuation mentioned, extract it
        "source_url": "https://exact-source-url.com"  // URL where this round was mentioned
      }
      // Include ALL rounds found in sources - Seed, Series A, Series B, Series C, etc.
    ],
    "investors": ["Alphabetical list of ALL unique investor names across all rounds"],
    "financial_metrics": [
      // Extract ALL financial metrics mentioned:
      {
        "fiscal_year": 2024,
        "revenue": 20000000,  // If "$20M revenue" mentioned
        "arr": 25000000,      // If ARR mentioned
        "mrr": 2000000,       // If MRR mentioned
        "profit": -5000000,   // If profit/loss mentioned (negative for loss)
        "revenue_growth_pct": 150,  // If growth rate mentioned (e.g., "150% growth")
        "user_count": 500000,  // If user/customer count mentioned
        "source_url": "https://source-url.com"
      }
    ]
  }
}

CRITICAL INSTRUCTIONS:
1. Extract EVERY funding amount mentioned - don't skip any rounds
2. Convert ALL amounts to numeric USD (e.g., "$5M" = 5000000, "$1.2B" = 1200000000)
3. Include EVERY investor name mentioned - be comprehensive
4. If a metric is not found, use null (not 0)
5. Preserve exact source URLs for verification
6. Be thorough - include 300-500 words of detail in funding category`,
        },
      ],
      temperature: 0.1, // Even lower temperature for more precise extraction
      max_tokens: 6000, // Reduced from 10000 to 6000 to stay within rate limits
    })

    let content = completion.choices[0]?.message?.content || "{}"
    const usage = completion.usage

    console.log("[v0] [Tavily+Groq] Received response, tokens:", usage?.total_tokens || 0)
    console.log(
      "[v0] [Tavily+Groq] Prompt tokens:",
      usage?.prompt_tokens || 0,
      "Completion tokens:",
      usage?.completion_tokens || 0,
    )

    // Clean and parse response
    content = cleanText(content)
    content = content
      .replace(/```(?:json)?\s*\n?/g, "")
      .replace(/\n?```/g, "")
      .trim()

    let analysis: any
    try {
      analysis = JSON.parse(content)
    } catch (parseError) {
      console.error("[v0] [Tavily+Groq] JSON parse error:", parseError)

      return {
        companyName: cleanText(companyName),
        summary: `Research completed for ${cleanText(companyName)} using web sources.`,
        categories: [
          {
            category: "Research Summary",
            content: cleanText(content.substring(0, 1000)),
            sources: Array.from(allSources).slice(0, 5),
          },
        ],
        generatedAt: new Date().toISOString(),
      }
    }

    analysis = deepCleanObject(analysis)

    // Build final result
    const result: CompanyResearchData = {
      companyName: cleanText(companyName),
      summary: analysis.summary || `Research for ${cleanText(companyName)}`,
      categories: (analysis.categories || []).map((cat: any) => ({
        category: cat.category || "Information",
        content: cat.content || "",
        sources: (cat.sources || []).filter((s: string) => s && s.startsWith("http")),
      })),
      generatedAt: new Date().toISOString(),
    }

    // Add funding data if available
    if (analysis.funding_data) {
      const fundingData = analysis.funding_data

      const validRounds = (fundingData.funding_rounds || [])
        .map((round: any) => ({
          round_type: round.round_type || "Unknown",
          amount_usd: Number(round.amount_usd) || 0,
          currency: "USD",
          announced_date: round.announced_date || "",
          lead_investors: (round.lead_investors || []).filter((inv: string) => inv && inv.trim().length > 0),
          other_investors: (round.other_investors || []).filter((inv: string) => inv && inv.trim().length > 0),
          post_money_valuation: round.post_money_valuation ? Number(round.post_money_valuation) : undefined,
          source_url: round.source_url || "",
          confidence_score: 0.9,
        }))
        .filter((round: any) => round.amount_usd > 0)

      const calculatedTotalFunding = validRounds.reduce((sum: number, round: any) => sum + round.amount_usd, 0)

      result.funding = {
        companyName: cleanText(companyName),
        funding_rounds: validRounds,
        total_funding: calculatedTotalFunding, // Use calculated sum instead of extracted value
        latest_valuation: fundingData.latest_valuation ? Number(fundingData.latest_valuation) : undefined,
        financial_metrics: (fundingData.financial_metrics || [])
          .map((metric: any) => ({
            fiscal_year: Number(metric.fiscal_year) || new Date().getFullYear(),
            fiscal_quarter: metric.fiscal_quarter ? Number(metric.fiscal_quarter) : undefined,
            revenue: metric.revenue ? Number(metric.revenue) : undefined,
            profit: metric.profit ? Number(metric.profit) : undefined,
            revenue_growth_pct: metric.revenue_growth_pct ? Number(metric.revenue_growth_pct) : undefined,
            user_count: metric.user_count ? Number(metric.user_count) : undefined,
            arr: metric.arr ? Number(metric.arr) : undefined,
            mrr: metric.mrr ? Number(metric.mrr) : undefined,
            source: metric.source || "Web Search",
            source_url: metric.source_url || "",
            confidence_score: 0.9,
          }))
          .filter((m: any) => m.revenue || m.arr || m.mrr || m.profit), // Only include metrics with actual data
        all_investors: (fundingData.investors || []).filter((inv: string) => inv && inv.trim().length > 0).sort(), // Sort investors alphabetically
        generatedAt: new Date().toISOString(),
      }

      console.log(
        "[v0] [Tavily+Groq] Extracted funding data:",
        validRounds.length,
        "rounds, total:",
        calculatedTotalFunding,
      )
    }

    console.log("[v0] [Tavily+Groq] Research completed successfully")

    // Return usage stats for cost tracking
    return {
      ...result,
      _usage: usage, // Hidden field for cost tracking
    } as any
  } catch (error) {
    console.error("[v0] [Tavily+Groq] Error:", error)

    return {
      companyName: cleanText(companyName),
      summary: `Research failed for ${cleanText(companyName)}: ${error instanceof Error ? error.message : "Unknown error"}`,
      categories: [
        {
          category: "Error",
          content: `Unable to complete research: ${error instanceof Error ? error.message : "Unknown error"}`,
          sources: [],
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}
