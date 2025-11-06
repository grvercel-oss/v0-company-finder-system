import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { searchCompanyWithTavily } from "@/lib/tavily"
import { auth } from "@clerk/nextjs/server"

const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

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
      console.log(`[v0] Using cached Tavily research for company ${id}`)
      return NextResponse.json({
        cached: true,
        data: company.tavily_research,
        fetchedAt: company.tavily_research_fetched_at,
      })
    }

    // Fetch fresh research from Tavily
    console.log(`[v0] Fetching fresh Tavily research for company: ${company.name}`)
    const research = await searchCompanyWithTavily(company.name, company.domain || company.website)

    // Save research to database
    await sql`
      UPDATE companies
      SET 
        tavily_research = ${JSON.stringify(research)},
        tavily_research_fetched_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    console.log(`[v0] Saved Tavily research for company ${id}`)

    return NextResponse.json({
      cached: false,
      data: research,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error fetching company research:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch company research" },
      { status: 500 },
    )
  }
}
