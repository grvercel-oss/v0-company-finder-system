import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    const searches = await sql`
      SELECT * FROM search_history 
      ORDER BY search_timestamp DESC 
      LIMIT 10
    `

    return NextResponse.json({ searches })
  } catch (error: any) {
    console.error("[v0] Recent searches API error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch recent searches" }, { status: 500 })
  }
}
