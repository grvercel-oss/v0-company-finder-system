import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    // Get companies stats
    const totalCompanies = await sql`SELECT COUNT(*) as count FROM companies`
    const verifiedCompanies = await sql`SELECT COUNT(*) as count FROM companies WHERE verified = true`
    const avgQuality =
      await sql`SELECT AVG(data_quality_score) as average FROM companies WHERE data_quality_score IS NOT NULL`

    // Get search stats
    const totalSearches = await sql`SELECT COUNT(*) as count FROM search_history`
    const totalSearchCost = await sql`SELECT SUM(total_cost) as total FROM search_history WHERE total_cost IS NOT NULL`

    // Get campaign stats
    const totalCampaigns = await sql`SELECT COUNT(*) as count FROM campaigns`
    const activeCampaigns = await sql`SELECT COUNT(*) as count FROM campaigns WHERE status = 'active'`

    // Get contact stats
    const totalContacts = await sql`SELECT COUNT(*) as count FROM contacts`
    const emailsSent = await sql`SELECT COUNT(*) as count FROM contacts WHERE status IN ('sent', 'replied')`
    const repliesReceived = await sql`SELECT COUNT(*) as count FROM contacts WHERE status = 'replied'`

    return NextResponse.json({
      companies: {
        total: Number(totalCompanies[0]?.count || 0),
        verified: Number(verifiedCompanies[0]?.count || 0),
        averageQuality: Math.round(Number(avgQuality[0]?.average || 0)),
      },
      searches: {
        total: Number(totalSearches[0]?.count || 0),
        totalCost: Number(totalSearchCost[0]?.total || 0),
      },
      campaigns: {
        total: Number(totalCampaigns[0]?.count || 0),
        active: Number(activeCampaigns[0]?.count || 0),
      },
      contacts: {
        total: Number(totalContacts[0]?.count || 0),
        sent: Number(emailsSent[0]?.count || 0),
        replied: Number(repliesReceived[0]?.count || 0),
        replyRate:
          Number(emailsSent[0]?.count || 0) > 0
            ? Math.round((Number(repliesReceived[0]?.count || 0) / Number(emailsSent[0]?.count || 0)) * 100)
            : 0,
      },
    })
  } catch (error: any) {
    console.error("[v0] Overview analytics API error:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch overview analytics",
        companies: { total: 0, verified: 0, averageQuality: 0 },
        searches: { total: 0, totalCost: 0 },
        campaigns: { total: 0, active: 0 },
        contacts: { total: 0, sent: 0, replied: 0, replyRate: 0 },
      },
      { status: 500 },
    )
  }
}
