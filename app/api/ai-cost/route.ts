// API route to fetch AI cost statistics

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get total cost for this user
    const totalResult = await sql`
      SELECT 
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COUNT(*) as total_requests
      FROM ai_usage_tracking
      WHERE account_id = ${userId}
    `

    // Get cost breakdown by model
    const modelBreakdown = await sql`
      SELECT 
        model,
        COUNT(*) as request_count,
        SUM(cost_usd) as total_cost,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens
      FROM ai_usage_tracking
      WHERE account_id = ${userId}
      GROUP BY model
      ORDER BY total_cost DESC
    `

    // Get cost breakdown by generation type
    const typeBreakdown = await sql`
      SELECT 
        generation_type,
        COUNT(*) as request_count,
        SUM(cost_usd) as total_cost
      FROM ai_usage_tracking
      WHERE account_id = ${userId}
      GROUP BY generation_type
      ORDER BY total_cost DESC
    `

    // Get recent usage (last 24 hours)
    const recentUsage = await sql`
      SELECT 
        COALESCE(SUM(cost_usd), 0) as cost_24h,
        COUNT(*) as requests_24h
      FROM ai_usage_tracking
      WHERE account_id = ${userId}
        AND created_at >= NOW() - INTERVAL '24 hours'
    `

    return NextResponse.json({
      totalCost: Number(totalResult[0].total_cost).toFixed(4),
      totalRequests: totalResult[0].total_requests,
      cost24h: Number(recentUsage[0].cost_24h).toFixed(4),
      requests24h: recentUsage[0].requests_24h,
      modelBreakdown: modelBreakdown.map((row: any) => ({
        model: row.model,
        requestCount: row.request_count,
        totalCost: Number(row.total_cost).toFixed(4),
        totalPromptTokens: row.total_prompt_tokens,
        totalCompletionTokens: row.total_completion_tokens,
      })),
      typeBreakdown: typeBreakdown.map((row: any) => ({
        type: row.generation_type,
        requestCount: row.request_count,
        totalCost: Number(row.total_cost).toFixed(4),
      })),
    })
  } catch (error) {
    console.error("[AI Cost API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch AI cost data" }, { status: 500 })
  }
}
