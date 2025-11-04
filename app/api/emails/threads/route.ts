import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const campaignId = searchParams.get("campaignId")

    const conditions = [sql`t.account_id = ${accountId}`]

    if (status) {
      conditions.push(sql`t.status = ${status}`)
    }

    if (campaignId) {
      conditions.push(sql`t.campaign_id = ${Number.parseInt(campaignId)}`)
    }

    const threads = await sql`
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
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
    `

    return NextResponse.json({ threads })
  } catch (error) {
    console.error("Error fetching threads:", error)
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 })
  }
}
