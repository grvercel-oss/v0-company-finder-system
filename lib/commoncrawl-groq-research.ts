// Common Crawl + Groq AI Research System (NO BRAVE/TAVILY)
// Uses only free, open-source Common Crawl archives + Groq AI

import Groq from "groq-sdk"

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
 * Search Common Crawl for company domain pages
 */
async function searchCommonCrawl(domain: string, indexUrl: string): Promise<CommonCrawlIndex[]> {
  console.log("[v0] [CC] Searching for domain:", domain)

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

      if (allRecords.length >= 15) break
    } catch (error) {
      console.error("[v0] [CC] Error searching path:", path, error)
    }
  }

  console.log("[v0] [CC] Found", allRecords.length, "pages")
  return allRecords.slice(0, 15)
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
 * Analyze company data with Groq AI
 */
async function analyzeWithGroq(companyName: string, pages: ExtractedPage[]): Promise<CompanyResearchData> {
  console.log("[v0] [Groq] Analyzing", pages.length, "pages for", companyName)

  const pagesText = pages
    .map((p, i) => `\n--- Page ${i + 1}: ${p.url} ---\n${p.content}`)
    .join("\n\n")
    .substring(0, 20000) // Limit total context

  const prompt = `You are analyzing web archive data from Common Crawl about "${companyName}".

Archived Web Pages:
${pagesText}

Create a comprehensive company research report with these sections:

1. **Company Overview** - What the company does, products/services, mission
2. **Industry & Market** - Market position, competitors, industry trends
3. **Financial Information** - Funding, revenue, investors, valuations
4. **Recent Developments** - News, partnerships, product launches
5. **Key Insights** - Strategic analysis and important takeaways

Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence executive summary",
  "categories": [
    {
      "category": "Company Overview",
      "content": "Detailed information extracted from pages",
      "sources": ["url1", "url2"]
    }
  ],
  "funding_data": {
    "total_funding": 0,
    "funding_rounds": [],
    "investors": [],
    "valuation": 0
  }
}

Extract ONLY factual information present in the archived pages. If information is not available, acknowledge it. Focus on being comprehensive but concise.`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a business intelligence analyst. Analyze archived web content and create structured reports. Return only valid JSON.",
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

    // Extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleanContent = jsonMatch ? jsonMatch[1].trim() : content.trim()

    const analysis = JSON.parse(cleanContent)

    return {
      companyName,
      summary: analysis.summary || `Research compiled from ${pages.length} archived web pages about ${companyName}.`,
      categories: analysis.categories || [],
      generatedAt: new Date().toISOString(),
      funding: analysis.funding_data
        ? {
            companyName,
            funding_rounds: analysis.funding_data.funding_rounds || [],
            total_funding: analysis.funding_data.total_funding || 0,
            latest_valuation: analysis.funding_data.valuation || undefined,
            financial_metrics: [],
            all_investors: analysis.funding_data.investors || [],
            generatedAt: new Date().toISOString(),
          }
        : undefined,
    }
  } catch (error) {
    console.error("[v0] [Groq] Error analyzing:", error)

    return {
      companyName,
      summary: `Research data compiled from ${pages.length} archived web pages. Analysis encountered an error.`,
      categories: [
        {
          category: "Archived Content",
          content: `Found ${pages.length} archived pages from ${companyName}'s website. Content analysis encountered an error.`,
          sources: pages.map((p) => p.url),
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Main research function using ONLY Common Crawl + Groq AI
 */
export async function researchCompanyWithCommonCrawlGroq(
  companyName: string,
  companyDomain?: string,
): Promise<CompanyResearchData> {
  console.log("[v0] Starting Common Crawl + Groq research for:", companyName)

  if (!companyDomain) {
    return {
      companyName,
      summary: "Domain not provided. Cannot search Common Crawl archives.",
      categories: [],
      generatedAt: new Date().toISOString(),
    }
  }

  try {
    // Step 1: Get latest Common Crawl index
    const indexUrl = await getLatestCrawlIndex()

    // Step 2: Search for company pages
    const records = await searchCommonCrawl(companyDomain, indexUrl)

    if (records.length === 0) {
      console.log("[v0] No pages found in Common Crawl for:", companyDomain)
      return {
        companyName,
        summary: `No archived pages found for ${companyDomain} in Common Crawl. The domain may be too new or not yet crawled.`,
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    }

    // Step 3: Extract text from pages (limit to 10 pages to avoid timeout)
    const extractedPages: ExtractedPage[] = []
    const maxPages = Math.min(10, records.length)

    for (let i = 0; i < maxPages; i++) {
      const record = records[i]
      console.log(`[v0] [CC] Extracting page ${i + 1}/${maxPages}:`, record.url)

      const content = await extractTextFromWARC(record)
      if (content && content.length > 200) {
        extractedPages.push({
          url: record.url,
          content,
          timestamp: record.timestamp,
        })
      }

      // Rate limiting
      if (i < maxPages - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800))
      }
    }

    console.log("[v0] Extracted", extractedPages.length, "pages with content")

    if (extractedPages.length === 0) {
      return {
        companyName,
        summary: `Found ${records.length} archived pages but could not extract readable content.`,
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
