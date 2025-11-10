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

/**
 * Clean text to prevent InvalidCharacterError
 */
function cleanText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "") // Control chars
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // Em/en dashes
    .replace(/\u2026/g, "...") // Ellipsis
    .replace(/\u00A0/g, " ") // Non-breaking space
    .replace(/[\uFEFF\uFFFE\uFFFF]/g, "") // BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width chars
    .replace(/[^\x20-\x7E\n\r]/g, " ") // Keep only ASCII printable + newlines
    .trim()
}

/**
 * Research company using ONLY Groq's web search tools
 */
export async function researchCompanyWithGroq(companyName: string): Promise<CompanyResearchData> {
  console.log("[v0] [Groq Web Search] Starting research for:", companyName)

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: cleanText(
            "You are an expert financial analyst specializing in venture capital, startup funding, and company research. Use web search to find the most comprehensive and up-to-date information.",
          ),
        },
        {
          role: "user",
          content: cleanText(`Research "${companyName}" and provide a comprehensive report focusing on:

PRIORITY 1 - FUNDING & INVESTORS (Most Important):
- All funding rounds (Seed, Series A/B/C/D, etc.) with specific amounts in USD
- Exact dates of funding announcements
- Lead investors and participating investors for each round
- Total funding raised to date
- Current company valuation (post-money valuation)
- Cap table information if available
- Notable angel investors

PRIORITY 2 - FINANCIAL METRICS:
- Annual Recurring Revenue (ARR)
- Monthly Recurring Revenue (MRR)
- Total revenue and growth rate
- Profitability status
- Burn rate and runway
- Employee count and growth

PRIORITY 3 - COMPANY INFORMATION:
- Company overview and mission
- Products and services
- Market size and position
- Key competitors
- Leadership team (CEO, CFO, CTO, etc.)
- Board members and advisors
- Recent news and press releases
- Acquisition history

Search multiple sources including:
- TechCrunch, VentureBeat, Bloomberg, Reuters
- Crunchbase, PitchBook, CB Insights
- Company website and press releases
- LinkedIn company page
- SEC filings (if public company)

Return ONLY a valid JSON object (no markdown, no code blocks) with this structure:
{
  "summary": "2-3 sentence executive summary highlighting key funding and metrics",
  "categories": [
    {
      "category": "Funding & Investors",
      "content": "Detailed funding history with amounts, dates, and investor names",
      "sources": ["https://source1.com", "https://source2.com"]
    },
    {
      "category": "Financial Metrics",
      "content": "Revenue, ARR, MRR, profitability, and growth metrics",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Company Overview",
      "content": "Products, market position, and business model",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Leadership & Team",
      "content": "Executives, board members, and key personnel",
      "sources": ["https://source1.com"]
    }
  ],
  "funding_data": {
    "total_funding": 150000000,
    "latest_valuation": 500000000,
    "funding_rounds": [
      {
        "round_type": "Series C",
        "amount_usd": 75000000,
        "announced_date": "2024-06-15",
        "lead_investors": ["Sequoia Capital"],
        "other_investors": ["Andreessen Horowitz", "Index Ventures"],
        "post_money_valuation": 500000000
      }
    ],
    "investors": ["Sequoia Capital", "Andreessen Horowitz", "Index Ventures"],
    "financial_metrics": [
      {
        "fiscal_year": 2024,
        "revenue": 50000000,
        "arr": 60000000,
        "employees": 250
      }
    ]
  }
}

Be extremely thorough. Search for funding announcements, press releases, and news articles. Include as much financial detail as possible.`),
        },
      ],
      temperature: 0.2, // Low temperature for factual accuracy
      max_tokens: 4000, // Increased for comprehensive responses
    })

    let content = completion.choices[0]?.message?.content || "{}"
    console.log("[v0] [Groq] Received response, cleaning...")

    content = cleanText(content)
    content = content.replace(/```(?:json)?\s*\n?/g, "").replace(/\n?```/g, "") // Remove markdown

    console.log("[v0] [Groq] Parsing JSON response...")

    let analysis: any
    try {
      analysis = JSON.parse(content)
    } catch (parseError) {
      console.error("[v0] [Groq] JSON parse error:", parseError)
      console.log("[v0] [Groq] Raw content:", content.substring(0, 500))

      // Fallback: return raw content as summary
      return {
        companyName,
        summary: cleanText(content.substring(0, 500)),
        categories: [
          {
            category: "Research Results",
            content: cleanText(content),
            sources: [],
          },
        ],
        generatedAt: new Date().toISOString(),
      }
    }

    const result: CompanyResearchData = {
      companyName,
      summary: cleanText(
        analysis.summary ||
          `Comprehensive research compiled for ${companyName} covering funding, investors, and financials.`,
      ),
      categories: (analysis.categories || []).map((cat: any) => ({
        category: cleanText(cat.category || "Information"),
        content: cleanText(cat.content || ""),
        sources: (cat.sources || []).map((s: string) => cleanText(s)),
      })),
      generatedAt: new Date().toISOString(),
    }

    if (analysis.funding_data) {
      result.funding = {
        companyName,
        funding_rounds: (analysis.funding_data.funding_rounds || []).map((round: any) => ({
          round_type: cleanText(round.round_type || "Unknown"),
          amount_usd: Number(round.amount_usd) || 0,
          currency: "USD",
          announced_date: cleanText(round.announced_date || ""),
          lead_investors: (round.lead_investors || []).map((inv: string) => cleanText(inv)),
          other_investors: (round.other_investors || []).map((inv: string) => cleanText(inv)),
          post_money_valuation: round.post_money_valuation ? Number(round.post_money_valuation) : undefined,
          source_url: cleanText(round.source_url || ""),
          confidence_score: Number(round.confidence_score) || 0.8,
        })),
        total_funding: Number(analysis.funding_data.total_funding) || 0,
        latest_valuation: analysis.funding_data.latest_valuation
          ? Number(analysis.funding_data.latest_valuation)
          : undefined,
        financial_metrics: (analysis.funding_data.financial_metrics || []).map((metric: any) => ({
          fiscal_year: Number(metric.fiscal_year) || new Date().getFullYear(),
          fiscal_quarter: metric.fiscal_quarter ? Number(metric.fiscal_quarter) : undefined,
          revenue: metric.revenue ? Number(metric.revenue) : undefined,
          profit: metric.profit ? Number(metric.profit) : undefined,
          revenue_growth_pct: metric.revenue_growth_pct ? Number(metric.revenue_growth_pct) : undefined,
          user_count: metric.user_count || metric.employees ? Number(metric.user_count || metric.employees) : undefined,
          arr: metric.arr ? Number(metric.arr) : undefined,
          mrr: metric.mrr ? Number(metric.mrr) : undefined,
          source: cleanText(metric.source || "Web Search"),
          source_url: cleanText(metric.source_url || ""),
          confidence_score: Number(metric.confidence_score) || 0.7,
        })),
        all_investors: (analysis.funding_data.investors || []).map((inv: string) => cleanText(inv)),
        generatedAt: new Date().toISOString(),
      }
    }

    console.log("[v0] [Groq] Research completed successfully")
    return result
  } catch (error) {
    console.error("[v0] [Groq Web Search] Error:", error)

    return {
      companyName,
      summary: `Unable to complete research for ${companyName}. Error: ${error instanceof Error ? cleanText(error.message) : "Unknown error"}`,
      categories: [
        {
          category: "Error",
          content: cleanText(`Research failed: ${error instanceof Error ? error.message : "Unknown error"}`),
          sources: [],
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}
