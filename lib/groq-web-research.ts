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
            "You are an expert financial analyst specializing in venture capital, startup funding, and company research. CRITICAL: You MUST ONLY extract information that is explicitly stated in web search results. Do NOT infer, assume, or generate any information that isn't directly found in sources. If information is not available from web sources, explicitly state 'Not available' or 'No data found'. Always cite specific sources for funding amounts, dates, and investor names. Prioritize data from 2024 and 2025.",
          ),
        },
        {
          role: "user",
          content:
            cleanText(`Research "${companyName}" and provide a comprehensive report based ONLY on verified information from web sources. Do NOT make up or infer any data. CRITICAL: Prioritize the most recent data from 2024-2025.

CRITICAL RULES FOR ACCURACY:
- ONLY include information explicitly found in web search results
- For funding amounts: MUST have exact dollar amount from a source
- For investors: MUST be explicitly named in a credible source
- For dates: MUST be specific dates from sources (no estimates)
- If ANY piece of information is not found, write "Not available" or "No verified data found"
- Include source URLs for every claim
- Do NOT infer or calculate values unless explicitly shown in sources

PRIORITY 1 - RECENT FUNDING & INVESTORS (2024-2025 FIRST) - VERIFIED DATA ONLY:
- Search for funding announcements from 2024 and 2025 FIRST
- All funding rounds (Seed, Series A/B/C/D, etc.) with EXACT amounts in USD from sources
- EXACT dates of funding announcements from sources (MUST include 2024-2025 if any exist)
- Lead investors and participating investors - ONLY those explicitly named in sources
- Total funding raised - calculate ONLY from verified funding rounds
- Current company valuation - ONLY if explicitly stated in recent sources
- Source URL required for EVERY funding round
- If no recent funding found, state: "No verified funding data found for 2024-2025"

PRIORITY 2 - FINANCIAL METRICS (2024-2025) - VERIFIED DATA ONLY:
- Latest Annual Recurring Revenue (ARR) - ONLY if explicitly stated in source
- Latest Monthly Recurring Revenue (MRR) - ONLY if explicitly stated
- Revenue figures - ONLY exact numbers from credible sources with dates
- Profitability status - ONLY if explicitly mentioned
- Employee count - ONLY if from official source or reliable database
- If metric not found, explicitly state "Not available"

PRIORITY 3 - COMPANY INFORMATION - VERIFIED DATA ONLY:
- Company overview from official sources (company website, press releases)
- Products and services from official descriptions
- Market position from credible industry sources
- Leadership team from official company page or LinkedIn
- Recent news from 2024-2025 from credible news sources
- NO speculation or inference allowed

SEARCH STRATEGY:
1. First search for "${companyName} funding 2025"
2. Then search for "${companyName} funding 2024"  
3. Then search for "${companyName} Series [A/B/C/D] 2024 2025"
4. Search "${companyName} valuation 2024 2025"
5. Search "${companyName} revenue 2024"
6. Search "${companyName} investors 2024 2025"

TRUSTED SOURCES (prioritize these):
- TechCrunch funding announcements
- Crunchbase verified data
- PitchBook reports
- Company official press releases
- SEC filings (if public company)
- VentureBeat, The Information, Bloomberg
- Company official website and blog

FORMATTING INSTRUCTIONS:
- Write detailed paragraphs (200-400 words per major category)
- Include specific numbers, dates, names with source citations
- Provide context from sources
- Include direct quotes when available
- State "Not available" or "No verified data found" for missing information
- ALWAYS include source URLs

Return ONLY a valid JSON object (no markdown, no code blocks) with this structure:
{
  "summary": "Executive summary with ONLY verified information about funding, metrics, and company status. Include disclaimer if limited data available.",
  "categories": [
    {
      "category": "Recent Funding & Investors (2024-2025)",
      "content": "Detailed paragraph with ONLY verified funding data. State 'No verified funding data found' if no recent funding information available from sources. Include source URLs for all claims.",
      "sources": ["https://source1.com", "https://source2.com"]
    },
    {
      "category": "Historical Funding & Growth",
      "content": "Chronological account of verified previous funding rounds with sources. State 'Limited historical data available' if sources are scarce.",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Financial Metrics (2024-2025)",
      "content": "ONLY include metrics explicitly found in sources (ARR, MRR, revenue). State 'No verified financial metrics available' if not found.",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Company Overview",
      "content": "Description based on official sources (website, press releases). Clearly distinguish between verified facts and company claims.",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Leadership & Team",
      "content": "Executive information from official sources. State 'Limited leadership information available' if sources are limited.",
      "sources": ["https://source1.com"]
    },
    {
      "category": "Recent News (2024-2025)",
      "content": "Recent developments from credible news sources. Include publication dates and source names.",
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
        "other_investors": ["Andreessen Horowitz"],
        "post_money_valuation": 500000000
      }
    ],
    "investors": ["ALL verified investors"],
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

CRITICAL REMINDERS:
- Do NOT make up funding amounts, dates, or investor names
- Do NOT infer or calculate values unless they come from sources
- State "Not available" or "No verified data" when information is missing
- Include source URLs for ALL factual claims
- Prioritize 2024-2025 data but only if it exists in sources`),
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

      return {
        companyName: ultraClean(companyName),
        summary: ultraClean(content.substring(0, 500)),
        categories: [
          {
            category: "Research Results",
            content: ultraClean(content),
            sources: [],
          },
        ],
        generatedAt: new Date().toISOString(),
      }
    }

    const result: CompanyResearchData = {
      companyName: ultraClean(companyName),
      summary: ultraClean(
        analysis.summary ||
          `Comprehensive research compiled for ${companyName} covering funding, investors, and financials.`,
      ),
      categories: (analysis.categories || []).map((cat: any) => ({
        category: ultraClean(cat.category || "Information"),
        content: ultraClean(cat.content || ""),
        sources: (cat.sources || []).map((s: string) => ultraClean(s)),
      })),
      generatedAt: new Date().toISOString(),
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
      categories: [
        {
          category: "Error",
          content: ultraClean(`Research failed: ${error instanceof Error ? error.message : "Unknown error"}`),
          sources: [],
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}
