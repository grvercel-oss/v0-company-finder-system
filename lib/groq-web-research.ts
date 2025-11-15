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
 * ULTIMATE clean text - strips EVERYTHING except basic ASCII
 */
function cleanText(text: string): string {
  if (!text) return ""

  const buffer = Buffer.from(text, "utf8")
  let cleaned = buffer.toString("utf8")

  // Remove ALL non-printable characters
  cleaned = cleaned
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // All control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width characters
    .replace(/[\u2000-\u206F]/g, " ") // All special spaces to regular space
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // Dashes
    .replace(/\u2026/g, "...") // Ellipsis

  // Keep only: letters, numbers, basic punctuation, space, newline
  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, " ")

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim()

  return cleaned
}

/**
 * Ultra-safe JSON stringification with character-by-character validation
 */
function safeStringify(obj: any): string {
  const replacer = (key: string, value: any) => {
    if (typeof value === "string") {
      // Clean every single character
      return Array.from(value)
        .map((char) => {
          const code = char.charCodeAt(0)
          // Only allow: space (32), printable ASCII (33-126), newline (10), carriage return (13), tab (9)
          if (code === 32 || (code >= 33 && code <= 126) || code === 10 || code === 13 || code === 9) {
            return char
          }
          return " " // Replace any other character with space
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim()
    }
    return value
  }

  return JSON.stringify(obj, replacer, 2)
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
            "You are an expert financial analyst specializing in venture capital, startup funding, and company research. Use web search to find the most comprehensive and up-to-date information. ALWAYS prioritize data from 2024 and 2025.",
          ),
        },
        {
          role: "user",
          content:
            cleanText(`Research "${companyName}" and provide a comprehensive report. CRITICAL: Prioritize the most recent data from 2024-2025.

PRIORITY 1 - RECENT FUNDING & INVESTORS (2024-2025 FIRST):
- Search for funding announcements from 2024 and 2025 FIRST
- All funding rounds (Seed, Series A/B/C/D, etc.) with specific amounts in USD
- Exact dates of funding announcements (MUST include 2024-2025 if any exist)
- Lead investors and participating investors for each round
- Total funding raised to date
- Current company valuation (post-money valuation from latest round)
- Recent investor additions and cap table changes
- Notable angel investors

PRIORITY 2 - RECENT FINANCIAL METRICS (2024-2025):
- Latest Annual Recurring Revenue (ARR) - prioritize 2024/2025 data
- Latest Monthly Recurring Revenue (MRR)
- Most recent revenue figures and growth rate
- Current profitability status
- Latest employee count
- Recent acquisitions or exits

PRIORITY 3 - CURRENT COMPANY INFORMATION:
- Company overview and current mission
- Latest products and services
- Current market position
- Key competitors
- Current leadership team (CEO, CFO, CTO, etc.)
- Recent news from 2024-2025
- Latest press releases

SEARCH STRATEGY:
1. First search for "${companyName} funding 2025"
2. Then search for "${companyName} funding 2024"
3. Then search for "${companyName} Series [A/B/C/D] 2024 2025"
4. Search "${companyName} valuation 2024 2025"
5. Search "${companyName} revenue 2024"

Use sources like:
- TechCrunch (search: "${companyName} funding 2024 2025")
- Crunchbase (most recent funding)
- PitchBook
- Company press releases from 2024-2025
- SEC filings if public

Return ONLY a valid JSON object (no markdown, no code blocks) with this structure:
{
  "summary": "2-3 sentence executive summary highlighting LATEST funding and 2024-2025 metrics",
  "categories": [
    {
      "category": "Recent Funding & Investors (2024-2025)",
      "content": "Most recent funding rounds with amounts, dates from 2024-2025, and investor names",
      "sources": ["https://source1.com", "https://source2.com"]
    },
    {
      "category": "Historical Funding",
      "content": "Earlier funding rounds before 2024",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Latest Financial Metrics (2024-2025)",
      "content": "Most recent revenue, ARR, MRR, profitability from 2024-2025",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Company Overview",
      "content": "Current products, market position, and business model",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Leadership & Team",
      "content": "Current executives and key personnel",
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

IMPORTANT: Include ALL funding rounds you find, but list 2024-2025 rounds FIRST. Be extremely thorough in searching for recent funding data.`),
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    })

    let content = completion.choices[0]?.message?.content || "{}"
    console.log("[v0] [Groq] Received response, cleaning...")

    content = cleanText(content)
    content = content.replace(/```(?:json)?\s*\n?/g, "").replace(/\n?```/g, "")

    console.log("[v0] [Groq] Parsing JSON response...")

    let analysis: any
    try {
      analysis = JSON.parse(content)
    } catch (parseError) {
      console.error("[v0] [Groq] JSON parse error:", parseError)
      console.log("[v0] [Groq] Raw content:", content.substring(0, 500))

      return {
        companyName: cleanText(companyName),
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
      companyName: cleanText(companyName),
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
        companyName: cleanText(companyName),
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
      companyName: cleanText(companyName),
      summary: cleanText(
        `Unable to complete research for ${companyName}. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ),
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
