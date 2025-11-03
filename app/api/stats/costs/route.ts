import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    // Get total costs
    const totalCosts = await sql`
      SELECT 
        COUNT(*) as total_searches,
        SUM(perplexity_cost) as total_perplexity_cost,
        SUM(openai_cost) as total_openai_cost,
        SUM(total_cost) as total_cost,
        AVG(total_cost) as avg_cost_per_search,
        SUM(perplexity_input_tokens) as total_perplexity_input_tokens,
        SUM(perplexity_output_tokens) as total_perplexity_output_tokens,
        SUM(openai_input_tokens) as total_openai_input_tokens,
        SUM(openai_output_tokens) as total_openai_output_tokens
      FROM search_history
      WHERE total_cost > 0
    `

    // Get costs by day (last 30 days)
    const costsByDay = await sql`
      SELECT 
        DATE(search_timestamp) as date,
        COUNT(*) as searches,
        SUM(total_cost) as daily_cost,
        SUM(perplexity_cost) as perplexity_cost,
        SUM(openai_cost) as openai_cost
      FROM search_history
      WHERE search_timestamp >= NOW() - INTERVAL '30 days'
        AND total_cost > 0
      GROUP BY DATE(search_timestamp)
      ORDER BY date DESC
    `

    // Get most expensive searches
    const expensiveSearches = await sql`
      SELECT 
        query,
        total_cost,
        perplexity_cost,
        openai_cost,
        results_count,
        search_timestamp
      FROM search_history
      WHERE total_cost > 0
      ORDER BY total_cost DESC
      LIMIT 10
    `

    return NextResponse.json({
      summary: totalCosts[0] || {},
      byDay: costsByDay,
      expensive: expensiveSearches,
    })
  } catch (error: any) {
    console.error("[v0] Error fetching cost stats:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
