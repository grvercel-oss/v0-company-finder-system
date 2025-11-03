import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET all campaigns
export async function GET() {
  try {
    const campaigns = await sql`
      SELECT 
        c.*,
        COUNT(DISTINCT co.id) as total_contacts,
        COUNT(DISTINCT CASE WHEN co.status = 'sent' THEN co.id END) as emails_sent,
        COUNT(DISTINCT CASE WHEN co.status = 'replied' THEN co.id END) as replies_received
      FROM campaigns c
      LEFT JOIN contacts co ON c.id = co.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error("Error fetching campaigns:", error)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }
}

// POST create new campaign
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO campaigns (name, description, status)
      VALUES (${name}, ${description || ""}, 'draft')
      RETURNING *
    `

    return NextResponse.json({ campaign: result[0] })
  } catch (error) {
    console.error("Error creating campaign:", error)
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}
