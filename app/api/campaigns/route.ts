import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

// GET all campaigns
export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    const campaigns = await sql`
      SELECT 
        c.*,
        COUNT(DISTINCT cc.contact_id) as total_contacts,
        0 as emails_sent,
        0 as replies_received
      FROM campaigns c
      LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
      WHERE c.account_id = ${accountId}
        AND c.deleted_at IS NULL
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
    const accountId = await getAccountIdFromRequest(request)

    const body = await request.json()
    const { name, description, email_prompt, icon = "mail", color = "blue" } = body

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO campaigns (name, description, email_prompt, status, icon, color, account_id)
      VALUES (${name}, ${description || ""}, ${email_prompt || null}, 'draft', ${icon}, ${color}, ${accountId})
      RETURNING *
    `

    return NextResponse.json({ campaign: result[0] })
  } catch (error) {
    console.error("Error creating campaign:", error)
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}
