import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] [THREAD-API] Request received for thread ID:", id)
    const threadId = Number.parseInt(id)

    if (isNaN(threadId)) {
      console.error("[v0] [THREAD-API] Invalid thread ID (NaN):", id)
      return NextResponse.json({ error: "Invalid thread ID" }, { status: 400 })
    }

    console.log("[v0] [THREAD-API] Parsed thread ID:", threadId)

    // Get thread details
    console.log("[v0] [THREAD-API] Querying database for thread...")
    const threads = await sql`
      SELECT 
        t.*,
        c.email as contact_email,
        c.first_name,
        c.last_name,
        c.company_name,
        c.job_title,
        camp.name as campaign_name,
        camp.description as campaign_description
      FROM email_threads t
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN campaigns camp ON t.campaign_id = camp.id
      WHERE t.id = ${threadId}
    `

    console.log("[v0] [THREAD-API] Thread query returned:", threads.length, "rows")

    if (threads.length === 0) {
      console.error("[v0] [THREAD-API] Thread not found in database:", threadId)
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const thread = threads[0]
    console.log("[v0] [THREAD-API] Thread found:", {
      id: thread.id,
      subject: thread.subject,
      contact_email: thread.contact_email,
    })

    // Get all messages in thread
    console.log(`[v0] [THREAD-API] Fetching messages for thread ${threadId}`)

    const messages = await sql`
      SELECT *
      FROM email_messages
      WHERE thread_id = ${threadId}
      ORDER BY 
        COALESCE(sent_at, received_at, created_at) ASC
    `

    console.log(`[v0] [THREAD-API] Found ${messages.length} messages`)
    messages.forEach((msg, idx) => {
      console.log(`[v0] [THREAD-API] Message ${idx + 1}:`, {
        id: msg.id,
        direction: msg.direction,
        from_email: msg.from_email,
        body_length: msg.body?.length || 0,
        html_body_length: msg.html_body?.length || 0,
        body_preview: msg.body?.substring(0, 50) || "(empty)",
        html_body_preview: msg.html_body?.substring(0, 50) || "(empty)",
      })
    })

    // Mark received messages as read
    await sql`
      UPDATE email_messages
      SET is_read = true
      WHERE thread_id = ${threadId} AND direction = 'received' AND is_read = false
    `

    // Update thread unread status
    await sql`
      UPDATE email_threads
      SET has_unread_replies = false
      WHERE id = ${threadId}
    `

    console.log("[v0] [THREAD-API] Successfully returning thread data")
    return NextResponse.json({ thread, messages })
  } catch (error) {
    console.error("[v0] [THREAD-API] Error fetching thread:", error)
    return NextResponse.json({ error: "Failed to fetch thread" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const threadId = Number.parseInt(id)

    if (isNaN(threadId)) {
      return NextResponse.json({ error: "Invalid thread ID" }, { status: 400 })
    }

    // Delete all messages in the thread first
    await sql`
      DELETE FROM email_messages
      WHERE thread_id = ${threadId}
    `

    // Delete the thread
    await sql`
      DELETE FROM email_threads
      WHERE id = ${threadId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting thread:", error)
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 })
  }
}
