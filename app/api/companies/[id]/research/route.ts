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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    }

    const { id } = await params

    console.log("[v0] [Research API] Fetching research for company ID:", id)

    const companies = await sql`
      SELECT id, name, domain, website, tavily_research, tavily_research_fetched_at
      FROM companies
      WHERE id = ${id}
    `

    if (companies.length === 0) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    }

    const company = companies[0]

    const cacheExpiry = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const fetchedAt = company.tavily_research_fetched_at ? new Date(company.tavily_research_fetched_at).getTime() : 0

    if (company.tavily_research && now - fetchedAt < cacheExpiry) {
      console.log(`[v0] [Research API] Using cached research for company ${id}`)

      const sanitizedData = sanitizeForJSON(company.tavily_research)

      const jsonString = JSON.stringify({
        cached: true,
        data: sanitizedData,
        fetchedAt: company.tavily_research_fetched_at,
      })

      return new Response(jsonString, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      })
    }

    console.log(`[v0] [Research API] Fetching fresh research for company: ${company.name}`)

    const research = await researchCompanyWithGemini(company.name).catch((err) => {
      console.error("[v0] [Research API] Gemini web search failed:", err)
      return {
        companyName: company.name,
        summary: "Research data could not be fetched at this time.",
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    })

    const sanitizedResearch = sanitizeForJSON(research)

    console.log("[v0] [Research API] Research completed, saving to database")

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

    const jsonString = JSON.stringify({
      cached: false,
      data: sanitizedResearch,
      fetchedAt: new Date().toISOString(),
    })

    return new Response(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("[v0] [Research API] Error fetching company research:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch company research" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    )
  }
}
