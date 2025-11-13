// Groq AI with Web Search Tools - NO Common Crawl, NO Brave, NO Tavily
// Uses ONLY Groq's built-in web search capabilities

import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.API_KEY_GROQ_API_KEY })

export interface NewsArticle {
  title: string
  url: string
  publishedDate: string
  source: string
  category?: string
}

export interface EmployeeData {
  total: number
  growth_6mo: number
  growth_yoy: number
  timeline: Array<{
    date: string
    count: number
  }>
  by_location: Array<{ location: string; percentage: number; count: number }>
  by_department: Array<{ department: string; percentage: number; count: number }>
  by_seniority: Array<{ level: string; percentage: number; count: number }>
}

export interface CompanyResearchData {
  companyName: string
  summary: string
  employees?: EmployeeData
  news_articles: NewsArticle[]
  ownership: string
  founded: string
  est_revenue: string
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
 * ULTRA AGGRESSIVE clean - removes EVERYTHING except basic safe characters
 */
function ultraClean(text: string): string {
  if (!text || typeof text !== "string") return ""

  // Convert to array and filter character by character
  const cleaned = Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0)
      // ONLY allow: space(32), basic punctuation and numbers(33-64), letters(65-90, 97-122)
      if (
        code === 32 || // space
        code === 10 || // newline
        (code >= 33 && code <= 126) // printable ASCII
      ) {
        return char
      }
      return " " // Replace everything else with space
    })
    .join("")
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim()

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
            "You are an expert financial analyst specializing in venture capital, startup funding, and company research. CRITICAL: You MUST ONLY extract information that is explicitly stated in web search results with VERIFIED SOURCE URLS. Do NOT infer, assume, or generate any information that isn't directly found in sources. If information is not available from web sources, explicitly state 'Not available' or 'No data found'. Always cite specific sources for funding amounts, dates, and investor names. Prioritize data from 2024 and 2025.",
          ),
        },
        {
          role: "user",
          content:
            cleanText(`Research "${companyName}" and provide a comprehensive report based ONLY on verified information from web sources with REAL, CLICKABLE URLS. Do NOT make up or infer any data. CRITICAL: Prioritize the most recent data from 2024-2025.

CRITICAL ACCURACY RULES:
- ONLY include information explicitly found in web search results
- EVERY piece of data MUST have a REAL source URL
- URLs MUST be complete, working links (https://...)
- NEVER create fake or placeholder URLs
- If no verified source exists, state "Not available" instead of making up data

PRIORITY 1 - NEWS & RECENT ACTIVITY (2024-2025):
- Find AT LEAST 10-20 recent news articles from 2024-2025
- Each article MUST have:
  - Exact title from the article
  - Complete source URL (https://...)
  - Publication date (must be real)
  - Source domain name
  - Category tag (Competition, Partnerships, Funding, Product, etc.)
- Sources to search: TechCrunch, VentureBeat, Bloomberg, Reuters, company blog, industry news sites
- NEVER create fake URLs - only include articles you actually found

PRIORITY 2 - EMPLOYEE DATA & GROWTH:
- Current employee count from LinkedIn, Crunchbase, or company website
- Historical employee counts with dates (for growth chart):
  - Monthly or quarterly data points if available
  - At least 5-10 data points over past 2-3 years
  - Format: { "date": "2024-01", "count": 343 }
- Employee breakdown by location (percentages and counts)
- Employee breakdown by department (Engineering, Marketing, Sales, etc.)
- Employee breakdown by seniority level (0-5 years, 5-10 years, 10-20 years, etc.)
- 6-month growth percentage
- Year-over-year growth percentage

PRIORITY 3 - COMPANY BASICS:
- Ownership type (Private, Public, Subsidiary)
- Founded year
- Estimated revenue or "n/a"

PRIORITY 4 - FUNDING & INVESTORS:
- All funding rounds with EXACT amounts and REAL source URLs
- List of all investors
- Total funding raised
- Latest valuation

Return ONLY a valid JSON object (no markdown, no code blocks) with this structure:
{
  "companyName": "${companyName}",
  "summary": "Brief company description from official source",
  "ownership": "Private" or "Public" or "Subsidiary",
  "founded": "2019" or "n/a",
  "est_revenue": "$50M" or "n/a",
  "news_articles": [
    {
      "title": "EXACT title from actual article",
      "url": "https://REAL-COMPLETE-URL.com/article",
      "publishedDate": "Nov 5, 2025" or "2025-11-05",
      "source": "techinasia.com",
      "category": "Competition" or "Partnerships" or "Funding" or "Product"
    }
  ],
  "employees": {
    "total": 343,
    "growth_6mo": 23,
    "growth_yoy": 40,
    "timeline": [
      { "date": "2024-11", "count": 343 },
      { "date": "2024-08", "count": 335 },
      { "date": "2024-05", "count": 310 }
    ],
    "by_location": [
      { "location": "Singapore", "percentage": 26, "count": 89 },
      { "location": "Spain", "percentage": 16, "count": 55 }
    ],
    "by_department": [
      { "department": "Engineering & R&D", "percentage": 37.4, "count": 128 },
      { "department": "Marketing & Comms", "percentage": 18.1, "count": 62 }
    ],
    "by_seniority": [
      { "level": "10 To 20 Years", "percentage": 41.8, "count": 143 },
      { "level": "5 To 10 Years", "percentage": 32.1, "count": 110 }
    ]
  },
  "funding_data": {
    "total_funding": 150000000,
    "latest_valuation": 500000000,
    "funding_rounds": [
      {
        "round_type": "Series C",
        "amount_usd": 75000000,
        "announced_date": "2024-06-15",
        "lead_investors": ["Sequoia Capital"],
        "other_investors": ["Andreessen Horowitz"],
        "source_url": "https://REAL-COMPLETE-SOURCE-URL.com"
      }
    ],
    "investors": ["ALL verified investors"],
    "financial_metrics": []
  },
  "categories": []
}

CRITICAL REMINDERS:
- ALL URLs must be complete, real, working links
- Do NOT create fake or placeholder URLs
- ONLY include news articles you actually found from real sources
- Employee data must come from LinkedIn, Crunchbase, or official sources
- State "Not available" when real data cannot be found`),
        },
      ],
      temperature: 0.0, // Lowest possible temperature for most deterministic, factual output
      max_tokens: 8000,
      top_p: 0.1, // Very low top_p to further reduce creative/hallucinatory responses
    })

    let content = completion.choices[0]?.message?.content || "{}"
    console.log("[v0] [Groq] Received response, cleaning...")

    content = ultraClean(content)
    content = content.replace(/```(?:json)?\s*\n?/g, "").replace(/\n?```/g, "")

    console.log("[v0] [Groq] Parsing JSON response...")

    let analysis: any
    try {
      analysis = JSON.parse(content)
    } catch (parseError) {
      console.error("[v0] [Groq] JSON parse error:", parseError)
      console.log("[v0] [Groq] Raw content:", content.substring(0, 500))

      // Return empty default structure instead of partial data
      return {
        companyName: ultraClean(companyName),
        summary: "No verified information found for this company.",
        ownership: "n/a",
        founded: "n/a",
        est_revenue: "n/a",
        news_articles: [],
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    }

    const result: CompanyResearchData = {
      companyName: ultraClean(companyName),
      summary: ultraClean(
        analysis.summary ||
          `Comprehensive research compiled for ${companyName} covering funding, investors, and financials.`,
      ),
      ownership: ultraClean(analysis.ownership || "n/a"),
      founded: ultraClean(analysis.founded || "n/a"),
      est_revenue: ultraClean(analysis.est_revenue || "n/a"),
      news_articles: (analysis.news_articles || []).map((article: any) => ({
        title: ultraClean(article.title || ""),
        url: ultraClean(article.url || ""),
        publishedDate: ultraClean(article.publishedDate || ""),
        source: ultraClean(article.source || ""),
        category: ultraClean(article.category || ""),
      })),
      categories: (analysis.categories || []).map((cat: any) => ({
        category: ultraClean(cat.category || "Information"),
        content: ultraClean(cat.content || ""),
        sources: (cat.sources || []).map((s: string) => ultraClean(s)),
      })),
      generatedAt: new Date().toISOString(),
    }

    if (analysis.employees) {
      result.employees = {
        total: Number(analysis.employees.total) || 0,
        growth_6mo: Number(analysis.employees.growth_6mo) || 0,
        growth_yoy: Number(analysis.employees.growth_yoy) || 0,
        timeline: (analysis.employees.timeline || []).map((point: any) => ({
          date: ultraClean(point.date || ""),
          count: Number(point.count) || 0,
        })),
        by_location: (analysis.employees.by_location || []).map((loc: any) => ({
          location: ultraClean(loc.location || ""),
          percentage: Number(loc.percentage) || 0,
          count: Number(loc.count) || 0,
        })),
        by_department: (analysis.employees.by_department || []).map((dept: any) => ({
          department: ultraClean(dept.department || ""),
          percentage: Number(dept.percentage) || 0,
          count: Number(dept.count) || 0,
        })),
        by_seniority: (analysis.employees.by_seniority || []).map((sen: any) => ({
          level: ultraClean(sen.level || ""),
          percentage: Number(sen.percentage) || 0,
          count: Number(sen.count) || 0,
        })),
      }
    }

    if (analysis.funding_data) {
      result.funding = {
        companyName: ultraClean(companyName),
        funding_rounds: (analysis.funding_data.funding_rounds || []).map((round: any) => ({
          round_type: ultraClean(round.round_type || "Unknown"),
          amount_usd: Number(round.amount_usd) || 0,
          currency: "USD",
          announced_date: ultraClean(round.announced_date || ""),
          lead_investors: (round.lead_investors || []).map((inv: string) => ultraClean(inv)),
          other_investors: (round.other_investors || []).map((inv: string) => ultraClean(inv)),
          post_money_valuation: round.post_money_valuation ? Number(round.post_money_valuation) : undefined,
          source_url: ultraClean(round.source_url || ""),
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
          source: ultraClean(metric.source || "Web Search"),
          source_url: ultraClean(metric.source_url || ""),
          confidence_score: Number(metric.confidence_score) || 0.7,
        })),
        all_investors: (analysis.funding_data.investors || []).map((inv: string) => ultraClean(inv)),
        generatedAt: new Date().toISOString(),
      }
    }

    console.log("[v0] [Groq] Research completed successfully")
    return result
  } catch (error) {
    console.error("[v0] [Groq Web Search] Error:", error)

    return {
      companyName: ultraClean(companyName),
      summary: ultraClean(
        `Unable to complete research for ${companyName}. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ),
      ownership: "n/a",
      founded: "n/a",
      est_revenue: "n/a",
      news_articles: [],
      categories: [],
      generatedAt: new Date().toISOString(),
    }
  }
}
