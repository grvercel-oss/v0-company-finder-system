import type { NextRequest } from "next/server"
import { neon } from "@neondatabase/serverless"
import { auth } from "@clerk/nextjs/server"
import { researchCompanyWithCommonCrawlGroq } from "@/lib/commoncrawl-groq-research"

const sql = neon(process.env.NEON_DATABASE_URL!)

function sanitizeForJSON(obj: any): any {
  if (typeof obj === "string") {
    return obj
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Remove control characters
      .replace(/[\u2018\u2019]/g, "'") // Smart quotes to regular quotes
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-") // Em/en dashes to hyphens
      .replace(/[\u2026]/g, "...") // Ellipsis
      .replace(/[^\x20-\x7E\n\r\t]/g, "") // Keep only printable ASCII + newline/tab
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJSON)
  }

  if (obj && typeof obj === "object") {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = sanitizeForJSON(value)
    }
    return cleaned
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

    const cachedData = await sql`
      SELECT 
        tavily_research,
        tavily_research_fetched_at
      FROM companies
      WHERE id = ${id}
        AND tavily_research IS NOT NULL
        AND tavily_research_fetched_at > NOW() - INTERVAL '7 days'
    `

    if (cachedData.length > 0 && cachedData[0].tavily_research) {
      console.log("[v0] [Research API] Returning cached research")
      const sanitizedData = sanitizeForJSON(cachedData[0].tavily_research)
      return new Response(
        JSON.stringify({
          cached: true,
          data: sanitizedData,
          fetchedAt: cachedData[0].tavily_research_fetched_at,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      )
    }

    const companies = await sql`
      SELECT id, name, domain, website
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

    console.log(`[v0] [Research API] Fetching fresh research for company: ${company.name}`)

    const research = await researchCompanyWithCommonCrawlGroq(company.name, company.domain || company.website).catch(
      (err) => {
        console.error("[v0] [Research API] Common Crawl + Groq research failed:", err)
        return {
          companyName: company.name,
          summary: "Research data could not be fetched at this time.",
          categories: [],
          generatedAt: new Date().toISOString(),
        }
      },
    )

    console.log("[v0] [Research API] Research completed, saving to database")

    const sanitizedResearch = sanitizeForJSON(research)

    await sql`
      UPDATE companies
      SET 
        tavily_research = ${JSON.stringify(sanitizedResearch)},
        tavily_research_fetched_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `.catch((err) => {
      console.error("[v0] [Research API] Error saving to database:", err)
    })

    console.log(`[v0] [Research API] Successfully saved research for company ${id}`)

    return new Response(
      JSON.stringify({
        cached: false,
        data: sanitizedResearch,
        fetchedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    )
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
