import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    // Get average quality score
    const avgResult = await sql`
      SELECT AVG(data_quality_score) as average FROM companies
    `
    const averageScore = Math.round(Number(avgResult[0]?.average || 0))

    // Get counts by quality tier
    const excellent = await sql`
      SELECT COUNT(*) as count FROM companies WHERE data_quality_score >= 80
    `

    const good = await sql`
      SELECT COUNT(*) as count FROM companies WHERE data_quality_score >= 50 AND data_quality_score < 80
    `

    const needsImprovement = await sql`
      SELECT COUNT(*) as count FROM companies WHERE data_quality_score < 50
    `

    const total = await sql`
      SELECT COUNT(*) as count FROM companies
    `

    return NextResponse.json({
      averageScore,
      excellent: Number(excellent[0]?.count || 0),
      good: Number(good[0]?.count || 0),
      needsImprovement: Number(needsImprovement[0]?.count || 0),
      total: Number(total[0]?.count || 0),
    })
  } catch (error: any) {
    console.error("[v0] Quality stats API error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch quality stats" }, { status: 500 })
  }
}
