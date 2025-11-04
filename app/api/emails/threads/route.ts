import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function GET(request: Request) {
  try {
    console.log("[v0] [THREADS] Fetching threads...")
    const accountId = await getAccountIdFromRequest(request)
    console.log("[v0] [THREADS] Using account_id:", accountId)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const campaignId = searchParams.get("campaignId")

    console.log("[v0] [THREADS] Query params:", {
      accountId,
      status,
      campaignId,
    })

    let threads

    if (status && campaignId) {
      threads = await sql`
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
        WHERE t.account_id = ${accountId}
          AND t.status = ${status}
          AND t.campaign_id = ${Number.parseInt(campaignId)}
        ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
      `
    } else if (status) {
      threads = await sql`
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
        WHERE t.account_id = ${accountId}
          AND t.status = ${status}
        ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
      `
    } else if (campaignId) {
      threads = await sql`
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
        WHERE t.account_id = ${accountId}
          AND t.campaign_id = ${Number.parseInt(campaignId)}
        ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
      `
    } else {
      threads = await sql`
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
        WHERE t.account_id = ${accountId}
        ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
      `
    }

    console.log("[v0] [THREADS] Found threads:", threads.length)
    if (threads.length > 0) {
      console.log("[v0] [THREADS] Sample thread:", {
        id: threads[0].id,
        account_id: threads[0].account_id,
        subject: threads[0].subject,
        contact_email: threads[0].contact_email,
      })
    }

    const allThreads = await sql`
      SELECT id, account_id, subject, contact_id, created_at 
      FROM email_threads 
      ORDER BY created_at DESC 
      LIMIT 5
    `
    console.log(
      "[v0] [THREADS] Recent threads in database (any account):",
      allThreads.map((t) => ({
        id: t.id,
        account_id: t.account_id,
        subject: t.subject,
      })),
    )

    return NextResponse.json({ threads })
  } catch (error) {
    console.error("[v0] [THREADS] Error fetching threads:", error)
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 })
  }
}
