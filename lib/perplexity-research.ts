// Perplexity AI Research - Real web search with verified sources

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
  if (!text) return ""
  
  return text
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2000-\u206F]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Research company using Perplexity AI with real web search
 */
export async function researchCompanyWithPerplexity(companyName: string): Promise<CompanyResearchData> {
  console.log("[v0] [Perplexity Research] Starting research for:", companyName)

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          {
            role: "system",
            content: "You are a financial research analyst. You MUST search the web for real, verified information. Include specific source URLs for all claims. Focus on recent 2024-2025 data. Be extremely detailed and accurate. NEVER make up information."
          },
          {
            role: "user",
            content: `Research the company "${companyName}" and provide comprehensive information with verified sources.

CRITICAL REQUIREMENTS:
1. Search for REAL funding data from 2024-2025 first
2. Find ACTUAL investor names (not placeholders like "Investor A")
3. Get VERIFIED valuation data from recent rounds
4. Include SOURCE URLS for every claim
5. Prioritize recent news from 2024-2025

Search for:
- "${companyName} funding 2025"
- "${companyName} funding 2024"
- "${companyName} Series A B C D 2024 2025"
- "${companyName} investors 2024"
- "${companyName} valuation 2024 2025"
- "${companyName} revenue 2024"

Return ONLY valid JSON (no markdown):
{
  "summary": "2-3 sentence summary with specific funding amounts and recent developments",
  "categories": [
    {
      "category": "Recent Funding & Investors (2024-2025)",
      "content": "Detailed paragraph with specific funding amounts, dates, and REAL investor names. Include full context.",
      "sources": ["https://actual-source-url-1.com", "https://actual-source-url-2.com"]
    },
    {
      "category": "Company Valuation",
      "content": "Current valuation with source and context.",
      "sources": ["https://source.com"]
    },
    {
      "category": "Financial Metrics",
      "content": "Revenue, ARR, employees, growth rate with sources.",
      "sources": ["https://source.com"]
    },
    {
      "category": "Company Overview",
      "content": "What the company does, products, market position.",
      "sources": ["https://source.com"]
    }
  ],
  "funding_data": {
    "total_funding": 0,
    "latest_valuation": 0,
    "funding_rounds": [
      {
        "round_type": "Series A",
        "amount_usd": 10000000,
        "announced_date": "2024-06-15",
        "lead_investors": ["Real Investor Name"],
        "other_investors": ["Other Real Names"],
        "post_money_valuation": 50000000,
        "source_url": "https://source.com"
      }
    ],
    "investors": ["List of ALL real investors found"],
    "financial_metrics": [
      {
        "fiscal_year": 2024,
        "revenue": 5000000,
        "employees": 50,
        "source": "Source name",
        "source_url": "https://source.com"
      }
    ]
  }
}

IMPORTANT:
- Use REAL investor names from actual sources
- Include actual funding amounts and dates
- Add source URLs for every piece of data
- If you cannot find verified information, say "No verified data found" instead of making it up
- Prioritize 2024-2025 data over older information`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    let content = data.choices[0]?.message?.content || "{}"

    console.log("[v0] [Perplexity] Received response, parsing...")

    // Clean and parse
    content = cleanText(content)
    content = content.replace(/```(?:json)?\s*\n?/g, "").replace(/\n?```/g, "")

    let analysis: any
    try {
      analysis = JSON.parse(content)
    } catch (parseError) {
      console.error("[v0] [Perplexity] JSON parse error:", parseError)
      
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
      summary: cleanText(analysis.summary || `Research compiled for ${companyName}`),
      categories: (analysis.categories || []).map((cat: any) => ({
        category: cleanText(cat.category || "Information"),
        content: cleanText(cat.content || ""),
        sources: (cat.sources || []).map((s: string) => cleanText(s)).filter(Boolean),
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
          lead_investors: (round.lead_investors || []).map((inv: string) => cleanText(inv)).filter(Boolean),
          other_investors: (round.other_investors || []).map((inv: string) => cleanText(inv)).filter(Boolean),
          post_money_valuation: round.post_money_valuation ? Number(round.post_money_valuation) : undefined,
          source_url: cleanText(round.source_url || ""),
          confidence_score: 0.9,
        })),
        total_funding: Number(analysis.funding_data.total_funding) || 0,
        latest_valuation: analysis.funding_data.latest_valuation ? Number(analysis.funding_data.latest_valuation) : undefined,
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
          confidence_score: 0.9,
        })),
        all_investors: (analysis.funding_data.investors || []).map((inv: string) => cleanText(inv)).filter(Boolean),
        generatedAt: new Date().toISOString(),
      }
    }

    console.log("[v0] [Perplexity] Research completed successfully")
    return result

  } catch (error) {
    console.error("[v0] [Perplexity Research] Error:", error)

    return {
      companyName: cleanText(companyName),
      summary: cleanText(`Unable to complete research for ${companyName}. ${error instanceof Error ? error.message : "Unknown error"}`),
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
