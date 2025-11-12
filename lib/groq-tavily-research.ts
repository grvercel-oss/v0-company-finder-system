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
        .filter((r) => r.score > 0.4)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 500)}\n`)
        .join("\n---\n"),

      investors_info: searchResults.investors.results
        .filter((r) => r.score > 0.4)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 500)}\n`)
        .join("\n---\n"),

      financial_info: searchResults.financial.results
        .filter((r) => r.score > 0.4)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 500)}\n`)
        .join("\n---\n"),

      news_info: searchResults.news.results
        .filter((r) => r.score > 0.4)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 500)}\n`)
        .join("\n---\n"),

      overview_info: searchResults.overview.results
        .filter((r) => r.score > 0.4)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.substring(0, 500)}\n`)
        .join("\n---\n"),
    }

    // Collect all unique source URLs
    const allSources = new Set<string>()
    ;[
      searchResults.funding,
      searchResults.investors,
      searchResults.financial,
      searchResults.news,
      searchResults.overview,
    ].forEach((result) => {
      result.results.forEach((r) => {
        if (r.score > 0.4) allSources.add(r.url)
      })
    })

    console.log("[v0] [Tavily+Groq] Found", allSources.size, "high-quality sources")

    // Step 3: Use Groq to analyze and structure the data
    console.log("[v0] [Tavily+Groq] Analyzing with Groq gpt-oss-20b...")

    const completion = await groq.chat.completions.create({
      model: "groq/openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content:
            "You are a financial research analyst. Analyze the provided web search results and extract accurate, factual information about the company. Only include information that is explicitly stated in the sources. If specific data is not found, mark it as 'Not available' rather than guessing. Always cite sources.",
        },
        {
          role: "user",
          content: `Analyze the following web search results about "${companyName}" and create a comprehensive research report.

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

Based on these search results, provide a detailed analysis in JSON format:

{
  "summary": "3-4 sentence summary highlighting key facts from the sources",
  "categories": [
    {
      "category": "Recent Funding & Investments",
      "content": "Detailed analysis (200-400 words) of funding rounds found in sources. Include specific amounts, dates, investors, and round types. ONLY include information explicitly stated in the sources.",
      "sources": ["https://source1.com", "https://source2.com"]
    },
    {
      "category": "Financial Performance & Metrics",
      "content": "Analysis of revenue, ARR, MRR, growth metrics found in sources. Include specific numbers and dates.",
      "sources": []
    },
    {
      "category": "Investors & Backers",
      "content": "List all investors mentioned in sources, organized by round if possible.",
      "sources": []
    },
    {
      "category": "Company Overview",
      "content": "What the company does, products, market, based on sources.",
      "sources": []
    },
    {
      "category": "Recent Developments",
      "content": "Recent news, announcements, milestones from sources.",
      "sources": []
    }
  ],
  "funding_data": {
    "total_funding": 0,
    "latest_valuation": null,
    "funding_rounds": [
      {
        "round_type": "Series A",
        "amount_usd": 10000000,
        "announced_date": "2024-03-15",
        "lead_investors": ["Lead VC"],
        "other_investors": ["Other VC"],
        "post_money_valuation": 50000000,
        "source_url": "https://source.com"
      }
    ],
    "investors": ["All unique investor names from sources"],
    "financial_metrics": [
      {
        "fiscal_year": 2024,
        "revenue": 5000000,
        "arr": 6000000,
        "source_url": "https://source.com"
      }
    ]
  }
}

IMPORTANT: Only extract facts explicitly stated in the provided sources. Do not infer or speculate.`,
        },
      ],
      temperature: 0.2, // Low temperature for factual extraction
      max_tokens: 8000,
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

      result.funding = {
        companyName: cleanText(companyName),
        funding_rounds: (fundingData.funding_rounds || [])
          .map((round: any) => ({
            round_type: round.round_type || "Unknown",
            amount_usd: Number(round.amount_usd) || 0,
            currency: "USD",
            announced_date: round.announced_date || "",
            lead_investors: (round.lead_investors || []).filter((inv: string) => inv),
            other_investors: (round.other_investors || []).filter((inv: string) => inv),
            post_money_valuation: round.post_money_valuation ? Number(round.post_money_valuation) : undefined,
            source_url: round.source_url || "",
            confidence_score: 0.9, // High confidence from web sources
          }))
          .filter((round: any) => round.amount_usd > 0),
        total_funding: Number(fundingData.total_funding) || 0,
        latest_valuation: fundingData.latest_valuation ? Number(fundingData.latest_valuation) : undefined,
        financial_metrics: (fundingData.financial_metrics || []).map((metric: any) => ({
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
        })),
        all_investors: (fundingData.investors || []).filter((inv: string) => inv && inv.length > 0),
        generatedAt: new Date().toISOString(),
      }
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
