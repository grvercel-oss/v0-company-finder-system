import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { researchCompanyWithGroq } from "@/lib/groq-web-research"
import { auth } from "@clerk/nextjs/server"

const sql = neon(process.env.NEON_DATABASE_URL!)

function sanitizeJSON(obj: any): any {
  if (typeof obj === "string") {
    return obj
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "") // Remove control chars except \t \n \r
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
      .replace(/\uFEFF/g, "") // Remove BOM
      .replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, " ") // Replace special spaces
      .replace(/[\u2060-\u2069]/g, "") // Remove invisible chars
      .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF]/g, "") // Keep only valid printable chars
      .trim()
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

function validateJSON(obj: any): boolean {
  try {
    const str = JSON.stringify(obj)
    JSON.parse(str)
    return true
  } catch {
    return false
  }
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

    const cacheExpiry = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const fetchedAt = company.tavily_research_fetched_at ? new Date(company.tavily_research_fetched_at).getTime() : 0

    if (company.tavily_research && now - fetchedAt < cacheExpiry) {
      console.log(`[v0] [Research API] Using cached research for company ${id}`)

      const sanitizedData = sanitizeJSON(company.tavily_research)

      if (!validateJSON(sanitizedData)) {
        console.error("[v0] [Research API] Cached data contains invalid JSON, fetching fresh data")
      } else {
        return NextResponse.json({
          cached: true,
          data: sanitizedData,
          fetchedAt: company.tavily_research_fetched_at,
        })
      }
    }

    console.log(`[v0] [Research API] Fetching fresh research for company: ${company.name}`)

    const research = await researchCompanyWithGroq(company.name).catch((err) => {
      console.error("[v0] [Research API] Groq web search failed:", err)
      return {
        companyName: company.name,
        summary: "Research data could not be fetched at this time.",
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    })

    const sanitizedResearch = sanitizeJSON(research)

    if (!validateJSON(sanitizedResearch)) {
      console.error("[v0] [Research API] Generated research contains invalid JSON")
      return NextResponse.json({ error: "Generated research contains invalid characters" }, { status: 500 })
    }

    console.log("[v0] [Research API] Research completed, saving to database")

    // Save research to database (reusing tavily_research column)
    await sql`
      UPDATE companies
      SET 
        tavily_research = ${JSON.stringify(sanitizedResearch)},
        tavily_research_fetched_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    if (research.funding && research.funding.funding_rounds && research.funding.funding_rounds.length > 0) {
      for (const round of research.funding.funding_rounds) {
        try {
          await sql`
            INSERT INTO company_funding (
              company_id, round_type, amount_usd, currency, announced_date,
              lead_investors, other_investors, post_money_valuation,
              source_url, confidence_score
            ) VALUES (
              ${id},
              ${round.round_type},
              ${round.amount_usd},
              ${round.currency},
              ${round.announced_date},
              ${round.lead_investors},
              ${round.other_investors},
              ${round.post_money_valuation || null},
              ${round.source_url},
              ${round.confidence_score}
            )
            ON CONFLICT DO NOTHING
          `
        } catch (error) {
          console.error("[v0] [Research API] Error storing funding round:", error)
        }
      }
    }

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
