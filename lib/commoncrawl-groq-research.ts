// Common Crawl + Groq AI Research System (NO BRAVE/TAVILY)
// Uses only free, open-source Common Crawl archives + Groq AI

import Groq from "groq-sdk"
import { DecompressionStream } from "node:stream/web"

const groq = new Groq({ apiKey: process.env.API_KEY_GROQ_API_KEY })

interface CommonCrawlIndex {
  urlkey: string
  timestamp: string
  url: string
  mime: string
  status: string
  digest: string
  length: string
  offset: string
  filename: string
}

interface ExtractedPage {
  url: string
  content: string
  timestamp: string
}

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
 * Get latest Common Crawl index
 */
async function getLatestCrawlIndex(): Promise<string> {
  console.log("[v0] [CC] Fetching latest crawl index")

  const response = await fetch("https://index.commoncrawl.org/collinfo.json")
  const indexes = await response.json()
  const latestIndex = indexes[0]["cdx-api"]

  console.log("[v0] [CC] Using index:", latestIndex)
  return latestIndex
}

/**
 * Search Common Crawl for company mentions across the entire web
 * (not just the company domain)
 */
async function searchMultipleSources(companyName: string, indexUrl: string): Promise<CommonCrawlIndex[]> {
  console.log("[v0] [CC] Searching multiple sources for:", companyName)

  const searchDomains = [
    // Tech news sites
    "techcrunch.com",
    "venturebeat.com",
    "theverge.com",
    "wired.com",
    "arstechnica.com",
    "engadget.com",
    // Business news
    "reuters.com",
    "bloomberg.com",
    "forbes.com",
    "businessinsider.com",
    "cnbc.com",
    // Press release sites
    "prnewswire.com",
    "businesswire.com",
    "globenewswire.com",
    // Investment/Funding
    "crunchbase.com",
    "pitchbook.com",
    "cbinsights.com",
  ]

  const allRecords: CommonCrawlIndex[] = []
  const companyQuery = encodeURIComponent(companyName)

  // Search major news/tech sites for company mentions
  for (const domain of searchDomains.slice(0, 10)) {
    // Limit to 10 domains for speed
    try {
      // Search for pages on this domain mentioning the company
      const searchUrl = `${indexUrl}?url=${domain}/*${companyQuery}*&output=json&limit=2`

      console.log("[v0] [CC] Searching domain:", domain)

      const response = await fetch(searchUrl)
      if (!response.ok) continue

      const text = await response.text()
      if (!text.trim()) continue

      const lines = text.trim().split("\n")

      for (const line of lines) {
        try {
          const record = JSON.parse(line) as CommonCrawlIndex
          if (record.status === "200" && record.mime?.includes("html")) {
            allRecords.push(record)
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }

      // Rate limiting to avoid overwhelming Common Crawl
      await new Promise((resolve) => setTimeout(resolve, 600))

      // Stop if we have enough records
      if (allRecords.length >= 15) break
    } catch (error) {
      console.error("[v0] [CC] Error searching domain:", domain, error)
    }
  }

  console.log("[v0] [CC] Found", allRecords.length, "pages from multiple sources")
  return allRecords.slice(0, 15)
}

/**
 * Search Common Crawl for company domain pages
 */
async function searchCompanyDomain(domain: string, indexUrl: string): Promise<CommonCrawlIndex[]> {
  console.log("[v0] [CC] Searching company domain:", domain)

  const paths = ["about", "company", "team", "investors", "funding", "products", "press", "news", ""]
  const allRecords: CommonCrawlIndex[] = []

  for (const path of paths) {
    try {
      const searchUrl = path
        ? `${indexUrl}?url=${domain}/${path}*&output=json&limit=3`
        : `${indexUrl}?url=${domain}/*&output=json&limit=5`

      const response = await fetch(searchUrl)
      if (!response.ok) continue

      const text = await response.text()
      const lines = text
        .trim()
        .split("\n")
        .filter((line) => line.trim())

      for (const line of lines) {
        try {
          const record = JSON.parse(line) as CommonCrawlIndex
          if (record.status === "200" && record.mime?.includes("html")) {
            allRecords.push(record)
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))

      if (allRecords.length >= 10) break
    } catch (error) {
      console.error("[v0] [CC] Error searching path:", path, error)
    }
  }

  console.log("[v0] [CC] Found", allRecords.length, "pages from company domain")
  return allRecords.slice(0, 10)
}

/**
 * Extract text from Common Crawl WARC record
 */
async function extractTextFromWARC(record: CommonCrawlIndex): Promise<string> {
  try {
    const warcUrl = `https://data.commoncrawl.org/${record.filename}`
    const rangeStart = Number.parseInt(record.offset)
    const rangeEnd = rangeStart + Number.parseInt(record.length) - 1

    const response = await fetch(warcUrl, {
      headers: {
        Range: `bytes=${rangeStart}-${rangeEnd}`,
      },
    })

    if (!response.ok) return ""

    // Get raw response (gzipped WARC)
    const arrayBuffer = await response.arrayBuffer()

    // Decompress using native DecompressionStream
    const blob = new Blob([arrayBuffer])
    const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"))
    const decompressed = await new Response(stream).text()

    // Extract HTML from WARC format
    const htmlMatch = decompressed.match(/<html[\s\S]*?<\/html>/i)
    if (!htmlMatch) return ""

    // Clean HTML to plain text
    const text = htmlMatch[0]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
      .trim()

    return text.substring(0, 3000) // Limit to 3000 chars per page
  } catch (error) {
    console.error("[v0] [CC] Error extracting text:", error)
    return ""
  }
}

/**
 * Analyze company data with Groq AI - ENHANCED FOR FUNDING DATA
 */
async function analyzeWithGroq(companyName: string, pages: ExtractedPage[]): Promise<CompanyResearchData> {
  console.log("[v0] [Groq] Analyzing", pages.length, "pages for", companyName)

  const pagesText = pages
    .map((p, i) => `\n--- Page ${i + 1}: ${p.url} ---\n${p.content}`)
    .join("\n\n")
    .substring(0, 25000) // Increased context limit for more data

  const prompt = `You are a financial analyst specializing in venture capital and startup funding. Analyze web archive data about "${companyName}".

ARCHIVED WEB PAGES:
${pagesText}

Your primary goal is to extract ALL funding, investor, and financial information. Be extremely thorough.

SEARCH FOR:
- Funding announcements (Seed, Series A, B, C, D, etc.)
- Investment amounts (convert all to USD if possible)
- Investor names (lead investors, participants, angels, VCs)
- Valuations (pre-money, post-money)
- Revenue numbers (ARR, MRR, total revenue)
- Financial metrics (profit, burn rate, runway)
- Acquisition details and prices
- Employee count and growth
- Key executive names and roles
- Board members and advisors

Return ONLY a JSON object (no markdown, no code blocks):
{
  "summary": "Brief 2-3 sentence executive summary",
  "categories": [
    {
      "category": "Funding & Investors",
      "content": "Detailed funding history with specific amounts, dates, and investor names",
      "sources": ["url1", "url2"]
    },
    {
      "category": "Financial Metrics",
      "content": "Revenue, profit, growth rates, and other financial data",
      "sources": ["url1"]
    },
    {
      "category": "Company Overview",
      "content": "Products, services, market position",
      "sources": ["url1"]
    },
    {
      "category": "Leadership & Team",
      "content": "Executives, board members, key hires",
      "sources": ["url1"]
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
    "revenue_usd": 50000000,
    "employees": 250
  }
}`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are an expert financial analyst. Extract ALL funding, investor, and financial data from text. Return only valid JSON with no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2, // Lower temperature for more factual extraction
      max_tokens: 3000, // Increased token limit for comprehensive responses
    })

    let content = completion.choices[0]?.message?.content || "{}"

    // Remove markdown code blocks
    content = content.replace(/```(?:json)?\s*\n?/g, "").replace(/\n?```/g, "")

    // Remove all problematic characters that cause InvalidCharacterError
    content = content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "") // Control chars
      .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
      .replace(/[\u2013\u2014]/g, "-") // Em/en dashes
      .replace(/\u2026/g, "...") // Ellipsis
      .replace(/\u00A0/g, " ") // Non-breaking space
      .replace(/[\uFEFF\uFFFE\uFFFF]/g, "") // BOM
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width chars
      .replace(/[^\x20-\x7E\n\r]/g, (char) => {
        // Keep only ASCII printable + newlines, or convert to safe equivalent
        const code = char.charCodeAt(0)
        if (code >= 0xa0 && code <= 0xff) return char // Keep Latin-1 supplement
        return " " // Replace everything else with space
      })
      .trim()

    const analysis = JSON.parse(content)

    return {
      companyName,
      summary:
        analysis.summary ||
        `Research compiled from ${pages.length} web sources covering funding, investors, and financials for ${companyName}.`,
      categories: analysis.categories || [],
      generatedAt: new Date().toISOString(),
      funding: analysis.funding_data
        ? {
            companyName,
            funding_rounds: (analysis.funding_data.funding_rounds || []).map((round: any) => ({
              round_type: round.round_type || "Unknown",
              amount_usd: round.amount_usd || 0,
              currency: "USD",
              announced_date: round.announced_date || "",
              lead_investors: round.lead_investors || [],
              other_investors: round.other_investors || [],
              post_money_valuation: round.post_money_valuation || undefined,
              source_url: round.source_url || "",
              confidence_score: round.confidence_score || 0.7,
            })),
            total_funding: analysis.funding_data.total_funding || 0,
            latest_valuation: analysis.funding_data.latest_valuation || analysis.funding_data.valuation || undefined,
            financial_metrics: [
              {
                fiscal_year: new Date().getFullYear(),
                revenue: analysis.funding_data.revenue_usd || undefined,
                user_count: analysis.funding_data.employees || undefined,
                source: "Common Crawl Archive",
                source_url: pages[0]?.url || "",
                confidence_score: 0.6,
              },
            ].filter((m) => m.revenue || m.user_count),
            all_investors: analysis.funding_data.investors || [],
            generatedAt: new Date().toISOString(),
          }
        : undefined,
    }
  } catch (error) {
    console.error("[v0] [Groq] Error analyzing:", error)

    return {
      companyName,
      summary: `Research data compiled from ${pages.length} archived web pages. Analysis encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
      categories: [
        {
          category: "Archived Content",
          content: `Found ${pages.length} archived pages from multiple sources. Content analysis encountered an error. Raw sources available for manual review.`,
          sources: pages.map((p) => p.url),
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Main research function using ONLY Common Crawl + Groq AI
 * Now searches multiple sources across the web
 */
export async function researchCompanyWithCommonCrawlGroq(
  companyName: string,
  companyDomain?: string,
): Promise<CompanyResearchData> {
  console.log("[v0] Starting Common Crawl + Groq research for:", companyName)

  try {
    // Step 1: Get latest Common Crawl index
    const indexUrl = await getLatestCrawlIndex()

    const [domainRecords, multiSourceRecords] = await Promise.all([
      companyDomain ? searchCompanyDomain(companyDomain, indexUrl) : Promise.resolve([]),
      searchMultipleSources(companyName, indexUrl),
    ])

    // Combine results, prioritizing company domain pages
    const allRecords = [...domainRecords, ...multiSourceRecords].slice(0, 20) // Increased to 20 pages

    if (allRecords.length === 0) {
      console.log("[v0] No pages found in Common Crawl for:", companyName)
      return {
        companyName,
        summary: `No archived pages found for ${companyName} in Common Crawl. The company may be too new or not yet crawled.`,
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    }

    console.log("[v0] Found total of", allRecords.length, "pages from all sources")

    // Step 3: Extract text from pages
    const extractedPages: ExtractedPage[] = []
    const maxPages = Math.min(12, allRecords.length) // Increased to 12 pages for more data

    for (let i = 0; i < maxPages; i++) {
      const record = allRecords[i]
      console.log(`[v0] [CC] Extracting page ${i + 1}/${maxPages}:`, record.url)

      const content = await extractTextFromWARC(record)
      if (content && content.length > 150) {
        extractedPages.push({
          url: record.url,
          content,
          timestamp: record.timestamp,
        })
      }

      if (i < maxPages - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600))
      }
    }

    console.log("[v0] Extracted", extractedPages.length, "pages with content")

    if (extractedPages.length === 0) {
      return {
        companyName,
        summary: `Found ${allRecords.length} archived pages but could not extract readable content.`,
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    }

    // Step 4: Analyze with Groq AI
    const research = await analyzeWithGroq(companyName, extractedPages)

    console.log("[v0] Research completed successfully")
    return research
  } catch (error) {
    console.error("[v0] Error in CC+Groq research:", error)
    throw error
  }
}
