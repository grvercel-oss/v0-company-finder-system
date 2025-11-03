import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET AI usage costs and analytics
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get("campaignId")

    // Get total costs
    const totalQuery = campaignId
      ? sql`
          SELECT 
            SUM(cost_usd) as total_cost,
            SUM(total_tokens) as total_tokens,
            COUNT(*) as total_generations,
            model
          FROM ai_usage_tracking
          WHERE campaign_id = ${campaignId}
          GROUP BY model
        `
      : sql`
          SELECT 
            SUM(cost_usd) as total_cost,
            SUM(total_tokens) as total_tokens,
            COUNT(*) as total_generations,
            model
          FROM ai_usage_tracking
          GROUP BY model
        `

    const totals = await totalQuery

    // Get costs by campaign
    const byCampaign = await sql`
      SELECT 
        c.id,
        c.name,
        SUM(a.cost_usd) as total_cost,
        SUM(a.total_tokens) as total_tokens,
        COUNT(a.id) as generation_count
      FROM campaigns c
      LEFT JOIN ai_usage_tracking a ON c.id = a.campaign_id
      GROUP BY c.id, c.name
      ORDER BY total_cost DESC NULLS LAST
    `

    // Get recent usage
    const recentUsage = campaignId
      ? await sql`
          SELECT 
            a.*,
            c.name as campaign_name,
            co.email as contact_email,
            co.first_name,
            co.last_name
          FROM ai_usage_tracking a
          LEFT JOIN campaigns c ON a.campaign_id = c.id
          LEFT JOIN contacts co ON a.contact_id = co.id
          WHERE a.campaign_id = ${campaignId}
          ORDER BY a.created_at DESC
          LIMIT 50
        `
      : await sql`
          SELECT 
            a.*,
            c.name as campaign_name,
            co.email as contact_email,
            co.first_name,
            co.last_name
          FROM ai_usage_tracking a
          LEFT JOIN campaigns c ON a.campaign_id = c.id
          LEFT JOIN contacts co ON a.contact_id = co.id
          ORDER BY a.created_at DESC
          LIMIT 50
        `

    // Get daily costs for chart
    const dailyCosts = campaignId
      ? await sql`
          SELECT 
            DATE(created_at) as date,
            SUM(cost_usd) as cost,
            SUM(total_tokens) as tokens,
            COUNT(*) as generations
          FROM ai_usage_tracking
          WHERE campaign_id = ${campaignId}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `
      : await sql`
          SELECT 
            DATE(created_at) as date,
            SUM(cost_usd) as cost,
            SUM(total_tokens) as tokens,
            COUNT(*) as generations
          FROM ai_usage_tracking
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `

    return NextResponse.json({
      totals,
      byCampaign,
      recentUsage,
      dailyCosts,
    })
  } catch (error) {
    console.error("[v0] Error fetching cost analytics:", error)
    return NextResponse.json({
      totals: [],
      byCampaign: [],
      recentUsage: [],
      dailyCosts: [],
      error: error instanceof Error ? error.message : "Failed to fetch analytics",
    })
  }
}
