import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const campaignId = searchParams.get("campaignId")

    let query = sql`
      SELECT 
        t.*,
        c.email as contact_email,
        c.first_name,
        c.last_name,
        c.company_name,
        camp.name as campaign_name,
        (SELECT COUNT(*) FROM email_messages WHERE thread_id = t.id AND direction = 'received' AND is_read = false) as unread_count
      FROM email_threads t
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN campaigns camp ON t.campaign_id = camp.id
      WHERE 1=1
    `

    if (status) {
      query = sql`${query} AND t.status = ${status}`
    }

    if (campaignId) {
      query = sql`${query} AND t.campaign_id = ${Number.parseInt(campaignId)}`
    }

    query = sql`${query} ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC`

    const threads = await query

    return NextResponse.json({ threads })
  } catch (error) {
    console.error("Error fetching threads:", error)
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 })
  }
}
