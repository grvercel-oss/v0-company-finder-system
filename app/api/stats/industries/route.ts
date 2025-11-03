import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    const total = await sql`SELECT COUNT(*) as count FROM companies WHERE industry IS NOT NULL`
    const totalCount = Number(total[0]?.count || 0)

    if (totalCount === 0) {
      return NextResponse.json({ industries: [] })
    }

    const industries = await sql`
      SELECT 
        industry,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / ${totalCount}), 1) as percentage
      FROM companies 
      WHERE industry IS NOT NULL
      GROUP BY industry 
      ORDER BY count DESC 
      LIMIT 10
    `

    return NextResponse.json({
      industries: industries.map((i) => ({
        industry: i.industry,
        count: Number(i.count),
        percentage: Number(i.percentage),
      })),
    })
  } catch (error: any) {
    console.error("[v0] Industries API error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch industry data" }, { status: 500 })
  }
}
