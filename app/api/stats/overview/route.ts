import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    const totalCompanies = await sql`SELECT COUNT(*) as count FROM companies WHERE account_id = ${accountId}`
    const totalSearches = await sql`SELECT COUNT(*) as count FROM search_history WHERE account_id = ${accountId}`
    const avgQuality =
      await sql`SELECT AVG(data_quality_score) as average FROM companies WHERE account_id = ${accountId}`
    const verifiedCompanies =
      await sql`SELECT COUNT(*) as count FROM companies WHERE account_id = ${accountId} AND verified = true`

    return NextResponse.json({
      totalCompanies: Number(totalCompanies[0]?.count || 0),
      totalSearches: Number(totalSearches[0]?.count || 0),
      averageQuality: Math.round(Number(avgQuality[0]?.average || 0)),
      verifiedCompanies: Number(verifiedCompanies[0]?.count || 0),
    })
  } catch (error: any) {
    console.error("[v0] Overview stats API error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch overview stats" }, { status: 500 })
  }
}
