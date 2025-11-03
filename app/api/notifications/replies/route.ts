import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest, withRLS } from "@/lib/rls-helper"

export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await withRLS(accountId, async () => {
      // Fetch unshown reply notifications from the last 24 hours
      const replies = await sql`
        SELECT 
          r.id,
          r.thread_id,
          r.from_email,
          r.from_name,
          r.subject,
          r.received_at,
          r.contact_id,
          t.id as thread_db_id
        FROM replies r
        LEFT JOIN email_threads t ON r.thread_id = t.thread_id
        WHERE r.account_id = ${accountId}
        AND r.notification_shown = false
        AND r.received_at > NOW() - INTERVAL '24 hours'
        ORDER BY r.received_at DESC
        LIMIT 5
      `

      // Mark as shown
      if (replies.length > 0) {
        const replyIds = replies.map((r) => r.id)
        await sql`
          UPDATE replies
          SET notification_shown = true, notification_shown_at = NOW()
          WHERE id = ANY(${replyIds}) AND account_id = ${accountId}
        `
      }

      return replies
    })

    // Map thread_id to the database ID for navigation
    const repliesWithDbId = result.map((r) => ({
      ...r,
      thread_id: r.thread_db_id || r.thread_id,
    }))

    return NextResponse.json({ replies: repliesWithDbId })
  } catch (error) {
    console.error("Error fetching reply notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
