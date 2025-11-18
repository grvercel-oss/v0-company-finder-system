import { GoogleGenerativeAI } from "@google/generative-ai"

function validateApiKey(key: string | undefined): string {
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set")
  }
  
  // Remove any whitespace or control characters
  const cleaned = key.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, "")
  
  // Check if key contains only valid characters (alphanumeric, dash, underscore)
  if (!/^[A-Za-z0-9_-]+$/.test(cleaned)) {
    console.error("[v0] [Gemini] API key contains invalid characters")
    throw new Error("GEMINI_API_KEY contains invalid characters. Please check your environment variables.")
  }
  
  return cleaned
}

const apiKey = validateApiKey(process.env.GEMINI_API_KEY)
const genAI = new GoogleGenerativeAI(apiKey)

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
 * Clean and validate string data
 */
function cleanString(value: unknown): string {
  if (typeof value !== "string") return ""
  // Remove control characters but keep basic punctuation and newlines
  return value
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
}

/**
 * Clean and validate number data
 */
function cleanNumber(value: unknown, defaultValue: number = 0): number {
  const num = Number(value)
  return isNaN(num) || !isFinite(num) ? defaultValue : num
}

/**
 * Clean and validate array data
 */
function cleanArray<T>(value: unknown, itemCleaner: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) return []
  return value.map(itemCleaner).filter((item) => item !== null && item !== undefined)
}

/**
 * Research company using Google Gemini with structured output
 */
export async function researchCompanyWithGemini(companyName: string): Promise<CompanyResearchData> {
  console.log("[v0] [Gemini] Starting research for:", companyName)

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseMimeType: "application/json",
      },
      tools: [{ googleSearch: {} }],
    })

    const schemaDescription = `
    {
      "summary": "2-3 sentence executive summary with latest funding and key metrics",
      "categories": [
        {
          "category": "Recent Funding & Valuation (2024-2025)",
          "content": "Latest funding rounds with specific amounts, dates, and investor names",
          "sources": ["https://techcrunch.com/...", "https://crunchbase.com/..."]
        },
        {
          "category": "Financial Performance",
          "content": "Revenue, ARR, MRR, profitability, growth rates",
          "sources": ["https://..."]
        },
        {
          "category": "Company Overview",
          "content": "Products, services, market position",
          "sources": ["https://..."]
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
            "post_money_valuation": 500000000,
            "source_url": "https://techcrunch.com/...",
            "confidence_score": 0.9
          }
        ],
        "investors": ["Sequoia Capital", "Andreessen Horowitz"],
        "financial_metrics": [
          {
            "fiscal_year": 2024,
            "revenue": 50000000,
            "arr": 60000000,
            "mrr": 5000000,
            "revenue_growth_pct": 150,
            "user_count": 10000,
            "source": "Company Press Release",
            "source_url": "https://...",
            "confidence_score": 0.8
          }
        ]
      }
    }`

    const prompt = `You are a professional business analyst researching "${companyName}". Use Google Search grounding to find the most recent and accurate information.

CRITICAL REQUIREMENTS:
1. ALWAYS search for 2024-2025 data FIRST
2. Include specific numbers with sources
3. Return valid JSON matching the exact schema below
4. If data is not found, use empty arrays [] or omit optional fields
5. All amounts must be in USD (convert if needed)
6. All dates in YYYY-MM-DD format

SEARCH PRIORITY:
1. "${companyName} funding 2025" OR "${companyName} funding 2024"
2. "${companyName} Series [A/B/C/D/E] 2024"
3. "${companyName} valuation 2024"
4. "${companyName} revenue 2024" OR "${companyName} ARR"
5. "${companyName} investors"

REQUIRED JSON SCHEMA:
${schemaDescription}

IMPORTANT:
- funding_data section is OPTIONAL but highly preferred if any funding info exists
- If no funding data found, OMIT the funding_data section entirely
- Always include at least 3 categories with content
- Each category MUST have real sources (URLs)
- Focus on factual, verifiable information from 2024-2025

Return ONLY the JSON object, nothing else.`

    console.log("[v0] [Gemini] Generating structured response...")
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    console.log("[v0] [Gemini] Parsing JSON response...")

    let rawData: any
    try {
      rawData = JSON.parse(text)
    } catch (parseError) {
      console.error("[v0] [Gemini] JSON parse failed:", parseError)
      throw new Error("Failed to parse Gemini response as JSON")
    }

    // Clean and validate the response
    const cleanedData: CompanyResearchData = {
      companyName: cleanString(companyName),
      summary: cleanString(rawData.summary) || `Research report for ${companyName}`,
      categories: cleanArray(rawData.categories, (cat: any) => ({
        category: cleanString(cat?.category) || "Information",
        content: cleanString(cat?.content) || "",
        sources: cleanArray(cat?.sources, (s) => cleanString(s)).filter((url) => url.startsWith("http")),
      })).filter((cat) => cat.content.length > 0),
      generatedAt: new Date().toISOString(),
    }

    // Process funding data if present
    if (rawData.funding_data && typeof rawData.funding_data === "object") {
      const fundingData = rawData.funding_data

      const fundingRounds = cleanArray(fundingData.funding_rounds, (round: any) => {
        if (!round || typeof round !== "object") return null

        const amountUsd = cleanNumber(round.amount_usd)
        const announcedDate = cleanString(round.announced_date)

        // Skip invalid rounds
        if (amountUsd === 0 || !announcedDate) return null

        return {
          round_type: cleanString(round.round_type) || "Unknown",
          amount_usd: amountUsd,
          currency: "USD",
          announced_date: announcedDate,
          lead_investors: cleanArray(round.lead_investors, (inv) => cleanString(inv)).filter((inv) => inv.length > 0),
          other_investors: cleanArray(round.other_investors, (inv) => cleanString(inv)).filter((inv) => inv.length > 0),
          post_money_valuation: round.post_money_valuation ? cleanNumber(round.post_money_valuation) : undefined,
          source_url: cleanString(round.source_url),
          confidence_score: cleanNumber(round.confidence_score, 0.7),
        }
      }).filter((round) => round !== null) as any[]

      const financialMetrics = cleanArray(fundingData.financial_metrics, (metric: any) => {
        if (!metric || typeof metric !== "object") return null

        const fiscalYear = cleanNumber(metric.fiscal_year)
        if (fiscalYear < 2000 || fiscalYear > 2030) return null

        return {
          fiscal_year: fiscalYear,
          fiscal_quarter: metric.fiscal_quarter ? cleanNumber(metric.fiscal_quarter) : undefined,
          revenue: metric.revenue ? cleanNumber(metric.revenue) : undefined,
          profit: metric.profit ? cleanNumber(metric.profit) : undefined,
          revenue_growth_pct: metric.revenue_growth_pct ? cleanNumber(metric.revenue_growth_pct) : undefined,
          user_count: metric.user_count ? cleanNumber(metric.user_count) : undefined,
          arr: metric.arr ? cleanNumber(metric.arr) : undefined,
          mrr: metric.mrr ? cleanNumber(metric.mrr) : undefined,
          source: cleanString(metric.source) || "Web Research",
          source_url: cleanString(metric.source_url),
          confidence_score: cleanNumber(metric.confidence_score, 0.7),
        }
      }).filter((metric) => metric !== null) as any[]

      const allInvestors = cleanArray(fundingData.investors, (inv) => cleanString(inv)).filter((inv) => inv.length > 0)

      const totalFunding = cleanNumber(fundingData.total_funding)
      const latestValuation = fundingData.latest_valuation ? cleanNumber(fundingData.latest_valuation) : undefined

      // Only include funding section if we have actual data
      if (fundingRounds.length > 0 || financialMetrics.length > 0 || totalFunding > 0) {
        cleanedData.funding = {
          companyName: cleanString(companyName),
          funding_rounds: fundingRounds,
          total_funding: totalFunding,
          latest_valuation: latestValuation,
          financial_metrics: financialMetrics,
          all_investors: allInvestors,
          generatedAt: new Date().toISOString(),
        }
      }
    }

    console.log(
      "[v0] [Gemini] Research completed:",
      cleanedData.categories.length,
      "categories,",
      cleanedData.funding?.funding_rounds?.length || 0,
      "funding rounds",
    )

    return cleanedData
  } catch (error) {
    console.error("[v0] [Gemini] Error during research:", error)

    return {
      companyName: cleanString(companyName),
      summary: `Unable to research ${companyName} at this time. ${error instanceof Error ? error.message : "Unknown error"}`,
      categories: [
        {
          category: "Error",
          content: `Research failed: ${error instanceof Error ? error.message : "Please try again later"}`,
          sources: [],
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}
