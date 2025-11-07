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

    const limit = request.nextUrl.searchParams.get("limit") || "10"

    console.log("[v0] Fetching search history for account:", accountId)

    // Get recent search requests with result counts
    const searches = await sql`
      SELECT 
        sr.id,
        sr.raw_query,
        sr.icp,
        sr.status,
        sr.created_at,
        sr.completed_at,
        COUNT(DISTINCT sres.company_id) as results_count
      FROM search_requests sr
      LEFT JOIN search_results sres ON sres.search_id = sr.id
      WHERE sr.account_id = ${accountId}
        AND sr.status = 'completed'
      GROUP BY sr.id
      ORDER BY sr.created_at DESC
      LIMIT ${limit}
    `

    console.log("[v0] Found", searches.length, "search history items")

    const history = searches.map((search: any) => ({
      id: search.id,
      query: search.raw_query,
      icp: search.icp,
      resultsCount: Number(search.results_count) || 0,
      createdAt: search.created_at,
      completedAt: search.completed_at,
    }))

    return NextResponse.json({ history })
  } catch (error: any) {
    console.error("[v0] Error fetching search history:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
