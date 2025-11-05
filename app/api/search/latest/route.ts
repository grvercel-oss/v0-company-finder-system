import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const accountId = await getAccountIdFromRequest()
    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Fetching latest search for account:", accountId)

    // Get the most recent completed search
    const searches = await sql`
      SELECT 
        sr.id,
        sr.raw_query,
        sr.icp,
        sr.status,
        sr.created_at,
        sr.completed_at,
        COUNT(sres.id) as results_count
      FROM search_requests sr
      LEFT JOIN search_results sres ON sres.search_id = sr.id
      WHERE sr.account_id = ${accountId}
        AND sr.status = 'completed'
      GROUP BY sr.id
      ORDER BY sr.created_at DESC
      LIMIT 1
    `

    if (searches.length === 0) {
      return NextResponse.json({ search: null, companies: [] })
    }

    const search = searches[0]

    // Get the companies from this search
    const companies = await sql`
      SELECT DISTINCT
        c.*,
        sres.source,
        sres.score
      FROM search_results sres
      JOIN companies c ON c.id = sres.company_id
      WHERE sres.search_id = ${search.id}
      ORDER BY sres.score DESC NULLS LAST, c.name ASC
    `

    console.log("[v0] Found latest search:", search.id, "with", companies.length, "companies")

    return NextResponse.json({
      search: {
        id: search.id,
        query: search.raw_query,
        icp: search.icp,
        status: search.status,
        createdAt: search.created_at,
        completedAt: search.completed_at,
        resultsCount: search.results_count,
      },
      companies,
    })
  } catch (error: any) {
    console.error("[v0] Error fetching latest search:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
