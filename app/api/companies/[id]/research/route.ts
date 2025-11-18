import type { NextRequest } from "next/server"
import { neon } from "@neondatabase/serverless"
import { researchCompanyWithGemini } from "@/lib/gemini-web-research"
import { auth } from "@clerk/nextjs/server"

const sql = neon(process.env.NEON_DATABASE_URL!)

function sanitizeForJSON(obj: any): any {
  if (typeof obj === "string") {
    // Only keep basic printable ASCII
    return obj
      .split("")
      .map((char) => {
        const code = char.charCodeAt(0)
        if (code >= 32 && code <= 126) return char
        if (code === 10 || code === 13) return " " // newlines to spaces
        return " "
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim()
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJSON)
  }
  if (obj !== null && typeof obj === "object") {
    const result: any = {}
    for (const key in obj) {
      result[key] = sanitizeForJSON(obj[key])
    }
    return result
  }
  return obj
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    console.log("[v0] [Research API] Fetching research for company ID:", id)

    const companies = await sql`
      SELECT id, name, domain, website, tavily_research, tavily_research_fetched_at
      FROM companies
      WHERE id = ${id}
    `

    if (companies.length === 0) {
      return Response.json({ error: "Company not found" }, { status: 404 })
    }

    const company = companies[0]

    // Check cache (7 days)
    const cacheExpiry = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const fetchedAt = company.tavily_research_fetched_at ? new Date(company.tavily_research_fetched_at).getTime() : 0

    if (company.tavily_research && now - fetchedAt < cacheExpiry) {
      console.log(`[v0] [Research API] Using cached research for company ${id}`)
      return Response.json({
        cached: true,
        data: company.tavily_research,
        fetchedAt: company.tavily_research_fetched_at,
      })
    }

    console.log(`[v0] [Research API] Fetching fresh research for: ${company.name}`)

    // Fetch fresh research
    const research = await researchCompanyWithGemini(company.name)

    console.log("[v0] [Research API] Research completed, saving to database")

    // Save to database
    await sql`
      UPDATE companies
      SET 
        tavily_research = ${JSON.stringify(research)},
        tavily_research_fetched_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    // Save funding rounds if present
    if (research.funding?.funding_rounds && research.funding.funding_rounds.length > 0) {
      console.log(`[v0] [Research API] Saving ${research.funding.funding_rounds.length} funding rounds`)
      
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

    console.log(`[v0] [Research API] Successfully completed research for ${company.name}`)

    return Response.json({
      cached: false,
      data: research,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] [Research API] Error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch company research" },
      { status: 500 },
    )
  }
}
