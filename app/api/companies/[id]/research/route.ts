import type { NextRequest } from "next/server"
import { neon } from "@neondatabase/serverless"
import { auth } from "@clerk/nextjs/server"
import { researchCompanyWithCommonCrawlGroq } from "@/lib/commoncrawl-groq-research"

const sql = neon(process.env.NEON_DATABASE_URL!)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    }

    const { id } = params

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
      return new Response(
        JSON.stringify({
          cached: true,
          data: cachedData[0].tavily_research,
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

    await sql`
      UPDATE companies
      SET 
        tavily_research = ${JSON.stringify(research)},
        tavily_research_fetched_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `.catch((err) => {
      console.error("[v0] [Research API] Error saving to database:", err)
    })

    console.log(`[v0] [Research API] Successfully saved research for company ${id}`)

    return new Response(
      JSON.stringify({
        cached: false,
        data: research,
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
