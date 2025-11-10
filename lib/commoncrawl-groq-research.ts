// Common Crawl + Groq AI Research System (NO BRAVE/TAVILY)
// Uses only free, open-source Common Crawl archives + Groq AI

import Groq from "groq-sdk"
import { DecompressionStream } from "web-streams-polyfill"

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
    key_partnerships?: string[]
    business_model?: string
    employee_count?: number
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
async function searchMultipleSources(
  companyName: string,
  domain: string,
  indexUrl: string,
): Promise<CommonCrawlIndex[]> {
  console.log("[v0] [CC] Enhanced multi-source search for:", companyName)

  const searchDomains = [
    // Funding & Investment databases
    "crunchbase.com",
    "pitchbook.com",
    "cbinsights.com",
    // Tech news sites (funding announcements)
    "techcrunch.com",
    "venturebeat.com",
    "theinformation.com",
    // Business news (financial data)
    "reuters.com",
    "bloomberg.com",
    "wsj.com",
    "forbes.com",
    "businessinsider.com",
    "ft.com",
    // Press release sites (funding announcements)
    "prnewswire.com",
    "businesswire.com",
    "globenewswire.com",
    // Industry specific
    "techradar.com",
    "zdnet.com",
    "computerworld.com",
  ]

  const allRecords: CommonCrawlIndex[] = []

  if (domain) {
    const domainRecords = await searchCompanyDomain(domain, indexUrl)
    allRecords.push(...domainRecords)
    console.log("[v0] [CC] Found", domainRecords.length, "pages from company domain")
  }

  for (const siteDomain of searchDomains) {
    try {
      // Try multiple URL patterns to find company mentions
      const searchUrl = `${indexUrl}?url=${siteDomain}/*&matchType=domain&output=json&limit=20`

      console.log("[v0] [CC] Searching:", siteDomain)

      const response = await fetch(searchUrl, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (!response.ok) {
        console.log("[v0] [CC] No results from:", siteDomain)
        continue
      }

      const text = await response.text()
      if (!text.trim()) continue

      const lines = text.trim().split("\n")

      for (const line of lines) {
        try {
          const record = JSON.parse(line) as CommonCrawlIndex

          // Filter for relevant pages (check URL and content type)
          if (
            record.status === "200" &&
            record.mime?.includes("html") &&
            (record.url.toLowerCase().includes(companyName.toLowerCase().split(" ")[0]) ||
              record.url.toLowerCase().includes(domain?.split(".")[0] || ""))
          ) {
            allRecords.push(record)
            console.log("[v0] [CC] Found relevant page:", record.url)
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 400))

      // Stop early if we have enough quality sources
      if (allRecords.length >= 25) {
        console.log("[v0] [CC] Reached target of 25 pages, stopping search")
        break
      }
    } catch (error: any) {
      if (error.name === "TimeoutError") {
        console.log("[v0] [CC] Timeout searching:", siteDomain)
      } else {
        console.error("[v0] [CC] Error searching domain:", siteDomain, error)
      }
    }
  }

  console.log("[v0] [CC] Total pages found:", allRecords.length)
  return allRecords.slice(0, 20) // Return top 20 most relevant
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
 * Perform focused funding analysis with Groq AI
 */
async function analyzeFundingWithGroq(companyName: string, pages: ExtractedPage[]): Promise<any> {
  console.log("[v0] [Groq] Running focused funding analysis")

  const pagesText = pages
    .map((p, i) => `\n--- Source ${i + 1}: ${p.url} (${p.timestamp}) ---\n${p.content}`)
    .join("\n\n")
    .substring(0, 25000)

  const fundingPrompt = `You are a financial analyst extracting funding and investor data about "${companyName}".

Archived Web Content:
${pagesText}

Extract ALL funding, investment, and financial information from these pages. Look for:
- Funding rounds (Seed, Series A/B/C/D, etc.)
- Investment amounts and dates
- Investor names (VC firms, angels, corporate investors)
- Valuations (pre-money, post-money)
- Revenue figures or financial metrics
- Acquisition prices
- Financial performance indicators

Return ONLY a JSON object:
{
  "funding_rounds": [
    {
      "round_type": "Series A",
      "amount_usd": 5000000,
      "currency": "USD",
      "announced_date": "2023-01-15",
      "lead_investors": ["Accel", "Sequoia"],
      "other_investors": ["Y Combinator"],
      "post_money_valuation": 25000000,
      "source_url": "url where found",
      "confidence_score": 0.95
    }
  ],
  "total_funding": 5000000,
  "latest_valuation": 25000000,
  "financial_metrics": [
    {
      "fiscal_year": 2023,
      "revenue": 10000000,
      "profit": 1000000,
      "revenue_growth_pct": 150,
      "source": "news article",
      "source_url": "url",
      "confidence_score": 0.8
    }
  ],
  "all_investors": ["Accel", "Sequoia", "Y Combinator"],
  "key_partnerships": ["Company X partnership", "Company Y acquisition"],
  "business_model": "SaaS/B2B/etc",
  "employee_count": 50
}

Be thorough. Extract every financial data point you can find. Use confidence scores (0-1) based on source reliability.`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a financial data extraction specialist. Extract structured funding data from text. Return only valid JSON with no markdown.",
        },
        {
          role: "user",
          content: fundingPrompt,
        },
      ],
      temperature: 0.2, // Lower temperature for more accurate extraction
      max_tokens: 3000,
    })

    const content = completion.choices[0]?.message?.content || "{}"

    // Clean and parse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.log("[v0] [Groq] No valid JSON found in funding analysis")
      return null
    }

    const cleanContent = jsonMatch[0]
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u00A0/g, " ")
      .replace(/[\uFEFF\uFFFE\uFFFF]/g, "")

    const fundingData = JSON.parse(cleanContent)
    console.log("[v0] [Groq] Extracted funding data with", fundingData.funding_rounds?.length || 0, "rounds")

    return fundingData
  } catch (error) {
    console.error("[v0] [Groq] Error in funding analysis:", error)
    return null
  }
}

/**
 * Analyze general company information with Groq AI
 */
async function analyzeGeneralInfo(
  companyName: string,
  pages: ExtractedPage[],
): Promise<Omit<CompanyResearchData, "funding">> {
  const pagesText = pages
    .map((p, i) => `\n--- Page ${i + 1}: ${p.url} ---\n${p.content}`)
    .join("\n\n")
    .substring(0, 20000)

  const prompt = `Analyze web archive data about "${companyName}".

Content:
${pagesText}

Create a comprehensive report. Return ONLY a JSON object:
{
  "summary": "2-3 sentence executive summary",
  "categories": [
    {
      "category": "Company Overview",
      "content": "What the company does, mission, products",
      "sources": ["url1", "url2"]
    },
    {
      "category": "Market & Industry",
      "content": "Industry position, market size, competitors",
      "sources": ["url1"]
    },
    {
      "category": "Recent Developments",
      "content": "News, product launches, partnerships",
      "sources": ["url1"]
    }
  ]
}

Be comprehensive. Extract all factual information available.`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a business analyst. Extract and structure company information from web content. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 2500,
    })

    const content = completion.choices[0]?.message?.content || "{}"
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    let cleanContent = jsonMatch ? jsonMatch[0] : content

    cleanContent = cleanContent
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u00A0/g, " ")
      .replace(/[\uFEFF\uFFFE\uFFFF]/g, "")
      .trim()

    const analysis = JSON.parse(cleanContent)

    return {
      companyName,
      summary: analysis.summary || `Research from ${pages.length} archived web pages about ${companyName}.`,
      categories: analysis.categories || [],
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[v0] [Groq] Error in general analysis:", error)
    return {
      companyName,
      summary: `Research from ${pages.length} archived pages. Analysis encountered an error.`,
      categories: [],
      generatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Analyze company data with Groq AI
 */
async function analyzeWithGroq(companyName: string, pages: ExtractedPage[]): Promise<CompanyResearchData> {
  console.log("[v0] [Groq] Analyzing", pages.length, "pages for", companyName)

  const [generalAnalysis, fundingAnalysis] = await Promise.all([
    analyzeGeneralInfo(companyName, pages),
    analyzeFundingWithGroq(companyName, pages),
  ])

  // Combine results
  return {
    ...generalAnalysis,
    funding: fundingAnalysis
      ? {
          companyName,
          funding_rounds: fundingAnalysis.funding_rounds || [],
          total_funding: fundingAnalysis.total_funding || 0,
          latest_valuation: fundingAnalysis.latest_valuation,
          financial_metrics: fundingAnalysis.financial_metrics || [],
          all_investors: fundingAnalysis.all_investors || [],
          generatedAt: new Date().toISOString(),
          key_partnerships: fundingAnalysis.key_partnerships,
          business_model: fundingAnalysis.business_model,
          employee_count: fundingAnalysis.employee_count,
        }
      : undefined,
  }
}

/**
 * Main research function using ONLY Common Crawl + Groq AI
 */
export async function researchCompanyWithCommonCrawlGroq(
  companyName: string,
  companyDomain?: string,
): Promise<CompanyResearchData> {
  console.log("[v0] Starting enhanced CC + Groq research for:", companyName)

  try {
    const indexUrl = await getLatestCrawlIndex()

    const allRecords = await searchMultipleSources(companyName, companyDomain || "", indexUrl)

    if (allRecords.length === 0) {
      console.log("[v0] No pages found in Common Crawl")
      return {
        companyName,
        summary: `No archived pages found for ${companyName}. The company may be too new or not widely covered.`,
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    }

    console.log("[v0] Processing", allRecords.length, "pages")

    const extractedPages: ExtractedPage[] = []
    const maxPages = Math.min(15, allRecords.length) // Increased from 10 to 15

    for (let i = 0; i < maxPages; i++) {
      const record = allRecords[i]
      console.log(`[v0] Extracting ${i + 1}/${maxPages}:`, record.url)

      const content = await extractTextFromWARC(record)
      if (content && content.length > 150) {
        // Lower threshold to capture more data
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

    console.log("[v0] Successfully extracted", extractedPages.length, "pages")

    if (extractedPages.length === 0) {
      return {
        companyName,
        summary: `Found ${allRecords.length} pages but could not extract content.`,
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    }

    const research = await analyzeWithGroq(companyName, extractedPages)

    console.log("[v0] Research completed with", research.categories.length, "categories")
    if (research.funding) {
      console.log("[v0] Found", research.funding.funding_rounds.length, "funding rounds")
      console.log("[v0] Total funding:", research.funding.total_funding)
    }

    return research
  } catch (error) {
    console.error("[v0] Error in research:", error)
    throw error
  }
}
