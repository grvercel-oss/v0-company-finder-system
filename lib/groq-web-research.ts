// Groq AI with Web Search Tools - NO Common Crawl, NO Brave, NO Tavily
// Uses ONLY Groq's built-in web search capabilities

import Groq from "groq-sdk"

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
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars except \t, \n, \r
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes to regular
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
 * Research company using Groq with web search tools
 */
export async function researchCompanyWithGroq(companyName: string): Promise<CompanyResearchData> {
  console.log("[v0] [Groq Web Search] Starting research for:", companyName)

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a financial research analyst. Use web search to find ACCURATE, VERIFIED information. ONLY include information you can verify from search results. If you cannot find specific data, say 'Not available' rather than guessing. Always include source URLs for each piece of information. Prioritize recent data from 2024-2025.",
        },
        {
          role: "user",
          content: `Research "${companyName}" and provide accurate, detailed information. Use web search extensively.

CRITICAL RULES:
- ONLY report facts you can verify from search results
- If data is not available, explicitly state "Not available" 
- Include actual source URLs for each claim
- Prioritize 2024-2025 data when available
- Focus on FACTUAL data: funding amounts, dates, investor names, revenue figures

Search for:
1. "${companyName} funding 2024 2025"
2. "${companyName} Series A B C D funding"
3. "${companyName} valuation revenue 2024"
4. "${companyName} investors Crunchbase"
5. "${companyName} TechCrunch funding announcement"

Return ONLY valid JSON (no markdown):
{
  "summary": "2-3 sentence factual summary with key metrics",
  "categories": [
    {
      "category": "Recent Funding (2024-2025)",
      "content": "Detailed paragraph with specific funding rounds, amounts, dates, and investors found. If no recent funding found, state that explicitly.",
      "sources": ["actual URLs from search results"]
    },
    {
      "category": "Historical Funding",
      "content": "Previous funding rounds with details",
      "sources": ["URLs"]
    },
    {
      "category": "Financial Metrics",
      "content": "Revenue, ARR, profitability data if available",
      "sources": ["URLs"]
    },
    {
      "category": "Company Overview",
      "content": "Business model, products, market position",
      "sources": ["URLs"]
    },
    {
      "category": "Leadership",
      "content": "Key executives and their backgrounds",
      "sources": ["URLs"]
    }
  ],
  "funding_data": {
    "total_funding": number or 0 if unknown,
    "latest_valuation": number or null,
    "funding_rounds": [
      {
        "round_type": "Series A",
        "amount_usd": 10000000,
        "announced_date": "2024-03-15",
        "lead_investors": ["Investor Name"],
        "other_investors": ["Others"],
        "post_money_valuation": 50000000,
        "source_url": "actual URL"
      }
    ],
    "investors": ["all unique investors"],
    "financial_metrics": [
      {
        "fiscal_year": 2024,
        "revenue": 5000000,
        "arr": 6000000,
        "source_url": "actual URL"
      }
    ]
  }
}`,
        },
      ],
      temperature: 0.2, // Lower temperature for more factual responses
      max_tokens: 8000,
      tools: [
        {
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for company information",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query",
                },
              },
              required: ["query"],
            },
          },
        },
      ],
      tool_choice: "auto",
    })

    let content = completion.choices[0]?.message?.content || "{}"
    console.log("[v0] [Groq] Received response length:", content.length)

    content = cleanText(content)
    content = content
      .replace(/```(?:json)?\s*\n?/g, "")
      .replace(/\n?```/g, "")
      .trim()

    let analysis: any
    try {
      analysis = JSON.parse(content)
    } catch (parseError) {
      console.error("[v0] [Groq] JSON parse error:", parseError)
      console.log("[v0] [Groq] First 200 chars:", content.substring(0, 200))

      return {
        companyName: cleanText(companyName),
        summary: `Research completed for ${cleanText(companyName)}. Unable to parse detailed results.`,
        categories: [
          {
            category: "Research Summary",
            content: cleanText(content.substring(0, 1000)),
            sources: [],
          },
        ],
        generatedAt: new Date().toISOString(),
      }
    }

    analysis = deepCleanObject(analysis)

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
            confidence_score: 0.8,
          }))
          .filter((round: any) => round.amount_usd > 0), // Only include rounds with actual amounts
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
          confidence_score: 0.7,
        })),
        all_investors: (fundingData.investors || []).filter((inv: string) => inv && inv.length > 0),
        generatedAt: new Date().toISOString(),
      }
    }

    console.log("[v0] [Groq] Research completed successfully")
    return result
  } catch (error) {
    console.error("[v0] [Groq Web Search] Error:", error)

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
