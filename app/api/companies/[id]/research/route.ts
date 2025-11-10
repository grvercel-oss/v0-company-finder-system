import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { researchCompanyWithGroqBrave } from "@/lib/groq-brave-research"
import { researchCompanyWithCommonCrawl } from "@/lib/commoncrawl"
import { auth } from "@clerk/nextjs/server"

const sql = neon(process.env.NEON_DATABASE_URL!)

function sanitizeJSON(obj: any): any {
  if (typeof obj === "string") {
    return obj
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Remove control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove unicode control chars
      .replace(/\uFEFF/g, "") // Remove BOM
      .replace(/[\u2000-\u200B\u2028\u2029]/g, " ") // Replace special spaces
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJSON)
  }
  if (obj !== null && typeof obj === "object") {
    const sanitized: any = {}
    for (const key in obj) {
      sanitized[key] = sanitizeJSON(obj[key])
    }
    return sanitized
  }
  return obj
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    console.log("[v0] [Research API] Fetching research for company ID:", id)

    // Get company from database
    const companies = await sql`
      SELECT id, name, domain, website, tavily_research, tavily_research_fetched_at
      FROM companies
      WHERE id = ${id}
    `

    if (companies.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const company = companies[0]

    // Check if we have cached research (less than 7 days old)
    const cacheExpiry = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    const now = Date.now()
    const fetchedAt = company.tavily_research_fetched_at ? new Date(company.tavily_research_fetched_at).getTime() : 0

    if (company.tavily_research && now - fetchedAt < cacheExpiry) {
      console.log(`[v0] [Research API] Using cached research for company ${id}`)

      const sanitizedData = sanitizeJSON(company.tavily_research)

      return NextResponse.json({
        cached: true,
        data: sanitizedData,
        fetchedAt: company.tavily_research_fetched_at,
      })
    }

    console.log(`[v0] [Research API] Fetching fresh research for company: ${company.name}`)

    const [braveResearch, commonCrawlData] = await Promise.all([
      researchCompanyWithGroqBrave(company.name, company.domain || company.website).catch((err) => {
        console.error("[v0] [Research API] Groq+Brave research failed:", err)
        return {
          companyName: company.name,
          summary: "Research data could not be fetched.",
          categories: [],
          generatedAt: new Date().toISOString(),
        }
      }),
      researchCompanyWithCommonCrawl(company.name, company.domain || company.website).catch((err) => {
        console.error("[v0] [Research API] Common Crawl research failed:", err)
        return null
      }),
    ])

    const research = {
      ...braveResearch,
      commonCrawlData: commonCrawlData || undefined,
    }

    const sanitizedResearch = sanitizeJSON(research)

    console.log("[v0] [Research API] Research completed, saving to database")

    // Save research to database (reusing tavily_research column)
    await sql`
      UPDATE companies
      SET 
        tavily_research = ${JSON.stringify(sanitizedResearch)},
        tavily_research_fetched_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    console.log(`[v0] [Research API] Successfully saved research for company ${id}`)

    return NextResponse.json({
      cached: false,
      data: sanitizedResearch,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] [Research API] Error fetching company research:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch company research" },
      { status: 500 },
    )
  }
}
