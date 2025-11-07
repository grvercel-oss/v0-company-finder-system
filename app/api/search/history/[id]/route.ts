import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const accountId = await getAccountIdFromRequest()
    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchId = params.id

    console.log("[v0] Fetching search results for search ID:", searchId)

    // Verify this search belongs to the user
    const searches = await sql`
      SELECT 
        sr.id,
        sr.raw_query,
        sr.icp,
        sr.status,
        sr.created_at,
        sr.completed_at
      FROM search_requests sr
      WHERE sr.id = ${searchId}
        AND sr.account_id = ${accountId}
        AND sr.status = 'completed'
    `

    if (searches.length === 0) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 })
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
      WHERE sres.search_id = ${searchId}
      ORDER BY sres.score DESC NULLS LAST, c.name ASC
    `

    console.log("[v0] Found", companies.length, "companies for search:", searchId)

    return NextResponse.json({
      search: {
        id: search.id,
        query: search.raw_query,
        icp: search.icp,
        status: search.status,
        createdAt: search.created_at,
        completedAt: search.completed_at,
      },
      companies,
    })
  } catch (error: any) {
    console.error("[v0] Error fetching search results:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
