// Common Crawl integration for extracting company data from archived web pages
// Free, open source web archive with billions of pages crawled monthly

interface CommonCrawlIndex {
  id: string
  name: string
  timegate: string
  "cdx-api": string
}

interface CDXRecord {
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

interface ExtractedContent {
  url: string
  title: string
  content: string
  timestamp: string
}

/**
 * Get list of available Common Crawl indexes
 */
async function getAvailableIndexes(): Promise<string[]> {
  try {
    console.log("[v0] [CommonCrawl] Fetching available indexes")
    const response = await fetch("https://index.commoncrawl.org/collinfo.json")

    if (!response.ok) {
      throw new Error(`Failed to fetch indexes: ${response.status}`)
    }

    const collections = (await response.json()) as CommonCrawlIndex[]
    const cdxApis = collections
      .filter((col) => col["cdx-api"])
      .map((col) => col["cdx-api"])
      .sort()
      .reverse()

    console.log("[v0] [CommonCrawl] Found", cdxApis.length, "indexes")
    return cdxApis
  } catch (error) {
    console.error("[v0] [CommonCrawl] Error fetching indexes:", error)
    return []
  }
}

/**
 * Search Common Crawl index for pages from a specific domain
 */
async function searchDomainInIndex(domain: string, cdxApi: string, limit = 20): Promise<CDXRecord[]> {
  try {
    console.log("[v0] [CommonCrawl] Searching for domain:", domain, "in index:", cdxApi)

    // Search for specific pages likely to contain company info
    const paths = ["about", "company", "team", "leadership", "contact", "products", ""]
    const records: CDXRecord[] = []

    for (const path of paths) {
      const searchUrl = path
        ? `${cdxApi}?url=${domain}/${path}*&output=json&limit=5`
        : `${cdxApi}?url=${domain}/*&output=json&limit=3`

      const response = await fetch(searchUrl)

      if (!response.ok) {
        console.warn("[v0] [CommonCrawl] Failed to search path:", path)
        continue
      }

      const text = await response.text()
      const lines = text
        .trim()
        .split("\n")
        .filter((line) => line.trim())

      for (const line of lines) {
        try {
          const record = JSON.parse(line) as CDXRecord
          // Only include successful HTML pages
          if (record.status === "200" && record.mime?.includes("html")) {
            records.push(record)
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }

      if (records.length >= limit) {
        break
      }
    }

    console.log("[v0] [CommonCrawl] Found", records.length, "records for", domain)
    return records.slice(0, limit)
  } catch (error) {
    console.error("[v0] [CommonCrawl] Error searching domain:", error)
    return []
  }
}

/**
 * Extract text content from WARC record
 */
async function extractContentFromWARC(record: CDXRecord): Promise<string | null> {
  try {
    const { offset, length, filename } = record
    const warcUrl = `https://data.commoncrawl.org/${filename}`

    // Download specific byte range
    const response = await fetch(warcUrl, {
      headers: {
        Range: `bytes=${offset}-${Number.parseInt(offset) + Number.parseInt(length) - 1}`,
      },
    })

    if (!response.ok) {
      console.warn("[v0] [CommonCrawl] Failed to fetch WARC record")
      return null
    }

    // Get the response as text (it's gzipped but we'll extract what we can)
    const text = await response.text()

    // Extract HTML content from WARC format
    // WARC format has headers, then HTTP headers, then HTML content
    const htmlMatch = text.match(/<html[\s\S]*?<\/html>/i)
    if (!htmlMatch) {
      return null
    }

    const html = htmlMatch[0]

    // Simple text extraction: remove scripts, styles, and tags
    let cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    // Limit to first 2000 characters
    cleanText = cleanText.substring(0, 2000)

    return cleanText
  } catch (error) {
    console.error("[v0] [CommonCrawl] Error extracting content:", error)
    return null
  }
}

/**
 * Research company using Common Crawl archives
 */
export async function researchCompanyWithCommonCrawl(
  companyName: string,
  domain: string,
): Promise<{
  companyName: string
  domain: string
  extractedContent: ExtractedContent[]
  summary: string
}> {
  console.log("[v0] [CommonCrawl] Starting research for:", companyName, domain)

  try {
    const indexes = await getAvailableIndexes()
    if (indexes.length === 0) {
      throw new Error("No Common Crawl indexes available")
    }

    // Use the most recent index
    const latestIndex = indexes[0]
    console.log("[v0] [CommonCrawl] Using index:", latestIndex)

    const records = await searchDomainInIndex(domain, latestIndex, 10)

    if (records.length === 0) {
      console.log("[v0] [CommonCrawl] No records found for domain:", domain)
      return {
        companyName,
        domain,
        extractedContent: [],
        summary: `No archived pages found for ${domain} in Common Crawl. The domain may be too new or not yet crawled.`,
      }
    }

    const extractedContent: ExtractedContent[] = []
    const maxRecords = Math.min(5, records.length)

    for (let i = 0; i < maxRecords; i++) {
      const record = records[i]
      console.log("[v0] [CommonCrawl] Extracting content from:", record.url)

      const content = await extractContentFromWARC(record)
      if (content && content.length > 100) {
        extractedContent.push({
          url: record.url,
          title: record.url.split("/").pop() || "Page",
          content,
          timestamp: record.timestamp,
        })
      }

      // Rate limiting: don't overwhelm the server
      if (i < maxRecords - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log("[v0] [CommonCrawl] Extracted", extractedContent.length, "pages")

    let summary = `Found ${extractedContent.length} archived pages for ${companyName}.`

    if (extractedContent.length > 0) {
      const apiKey = process.env.API_KEY_GROQ_API_KEY

      if (apiKey) {
        try {
          const contentText = extractedContent
            .map((item) => `URL: ${item.url}\nContent: ${item.content.substring(0, 500)}`)
            .join("\n\n")

          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content:
                    "You are analyzing archived web pages from Common Crawl. Summarize what you learn about this company in 2-3 sentences.",
                },
                {
                  role: "user",
                  content: `Company: ${companyName}\n\nArchived Pages:\n${contentText}\n\nSummarize what these pages reveal about the company.`,
                },
              ],
              temperature: 0.3,
              max_tokens: 200,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            summary = data.choices[0]?.message?.content || summary
          }
        } catch (error) {
          console.error("[v0] [CommonCrawl] Error generating AI summary:", error)
        }
      }
    }

    return {
      companyName,
      domain,
      extractedContent,
      summary,
    }
  } catch (error) {
    console.error("[v0] [CommonCrawl] Research error:", error)
    throw error
  }
}
