// Common Crawl + Groq AI Research System (NO BRAVE/TAVILY)
// Uses only free, open-source Common Crawl archives + Groq AI

import Groq from "groq-sdk"
import { gunzipSync } from "node:zlib"

const groq = new Groq({ apiKey: process.env.API_KEY_GROQ_API_KEY })

function cleanText(text: string): string {
  if (!text || typeof text !== "string") return ""

  return (
    text
      // Remove ALL control characters
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
      // Remove BOM and invalid Unicode
      .replace(/[\uFEFF\uFFFE\uFFFF]/g, "")
      // Convert special quotes to ASCII
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Convert dashes to ASCII
      .replace(/[\u2013\u2014]/g, "-")
      // Convert special spaces to normal space
      .replace(/[\u00A0\u2000-\u200F\u2028-\u202F]/g, " ")
      // Remove invisible characters
      .replace(/[\u200B-\u200D\u2060-\u2069]/g, "")
      // Keep only printable ASCII + basic Latin
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  )
}

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

    const buffer = Buffer.from(arrayBuffer)
    const decompressed = gunzipSync(buffer).toString("utf-8")

    // Extract HTML from WARC format
    const htmlMatch = decompressed.match(/<html[\s\S]*?<\/html>/i)
    if (!htmlMatch) return ""

    // Clean HTML to plain text with aggressive sanitization
    const text = htmlMatch[0]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")

    const cleanedText = cleanText(text)

    return cleanedText.substring(0, 5000) // Limit to 5000 chars per page
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
    .map((p, i) => {
      const cleanContent = cleanText(p.content)
      const cleanUrl = cleanText(p.url)
      return `\n--- Source ${i + 1}: ${cleanUrl} ---\n${cleanContent}`
    })
    .join("\n\n")
    .substring(0, 40000)

  const fundingPrompt = `You are a financial analyst extracting funding and investor data about "${cleanText(companyName)}".

Archived Web Content from news sites, press releases, and financial databases:
${pagesText}

Extract ALL funding, investment, and financial information. Return ONLY valid JSON with NO special characters or formatting.

Use this exact structure:
{
  "funding_rounds": [],
  "total_funding": 0,
  "latest_valuation": 0,
  "financial_metrics": [],
  "all_investors": [],
  "key_partnerships": [],
  "business_model": "",
  "employee_count": 0
}

IMPORTANT: Use only ASCII characters. No special quotes, dashes, or Unicode.`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a financial data extraction specialist. Return only valid JSON with ASCII characters. No markdown, no special characters.",
        },
        {
          role: "user",
          content: fundingPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    })

    const content = completion.choices[0]?.message?.content || "{}"

    const cleanedContent = cleanText(content)

    // Extract JSON from response
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.log("[v0] [Groq] No valid JSON found in funding analysis")
      return null
    }

    const fundingData = JSON.parse(jsonMatch[0])
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
    .map((p, i) => {
      const cleanContent = cleanText(p.content)
      const cleanUrl = cleanText(p.url)
      return `\n--- Page ${i + 1}: ${cleanUrl} ---\n${cleanContent}`
    })
    .join("\n\n")
    .substring(0, 20000)

  const prompt = `Analyze web archive data about "${cleanText(companyName)}".

Content:
${pagesText}

Return ONLY valid JSON with ASCII characters. No special characters or markdown.

Use this exact structure:
{
  "summary": "Brief company overview",
  "categories": [
    {
      "category": "Company Overview",
      "content": "Description",
      "sources": []
    }
  ]
}`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a business analyst. Return only valid JSON with ASCII characters. No markdown or special characters.",
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

    const cleanedContent = cleanText(content)

    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    return {
      companyName: cleanText(companyName),
      summary: cleanText(analysis.summary || `Research from ${pages.length} archived web pages.`),
      categories: Array.isArray(analysis.categories)
        ? analysis.categories.map((cat: any) => ({
            category: cleanText(cat.category || ""),
            content: cleanText(cat.content || ""),
            sources: Array.isArray(cat.sources) ? cat.sources.map(cleanText) : [],
          }))
        : [],
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[v0] [Groq] Error in general analysis:", error)
    return {
      companyName: cleanText(companyName),
      summary: `Research from ${pages.length} archived pages.`,
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
          companyName: cleanText(companyName),
          funding_rounds: fundingAnalysis.funding_rounds || [],
          total_funding: fundingAnalysis.total_funding || 0,
          latest_valuation: fundingAnalysis.latest_valuation,
          financial_metrics: fundingAnalysis.financial_metrics || [],
          all_investors: Array.isArray(fundingAnalysis.all_investors)
            ? fundingAnalysis.all_investors.map(cleanText)
            : [],
          generatedAt: new Date().toISOString(),
          key_partnerships: Array.isArray(fundingAnalysis.key_partnerships)
            ? fundingAnalysis.key_partnerships.map(cleanText)
            : undefined,
          business_model: fundingAnalysis.business_model ? cleanText(fundingAnalysis.business_model) : undefined,
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
        companyName: cleanText(companyName),
        summary: `No archived pages found for ${cleanText(companyName)}. The company may be too new.`,
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    }

    console.log("[v0] Processing", allRecords.length, "pages")

    const extractedPages: ExtractedPage[] = []
    const maxPages = Math.min(20, allRecords.length)

    for (let i = 0; i < maxPages; i++) {
      const record = allRecords[i]
      console.log(`[v0] Extracting ${i + 1}/${maxPages}:`, record.url)

      const content = await extractTextFromWARC(record)
      if (content && content.length > 100) {
        extractedPages.push({
          url: cleanText(record.url),
          content: content, // Already cleaned in extractTextFromWARC
          timestamp: record.timestamp,
        })
      }

      if (i < maxPages - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
    }

    console.log("[v0] Successfully extracted", extractedPages.length, "pages")

    if (extractedPages.length === 0) {
      return {
        companyName: cleanText(companyName),
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
    console.error("[v0] [CC] Error in research:", error)
    throw error
  }
}
