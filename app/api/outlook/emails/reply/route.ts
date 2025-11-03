import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sendOutlookReply } from "@/lib/outlook-mail"
import { getAccountId } from "@/lib/rls-helper"

export async function POST(request: Request) {
  try {
    const accountId = await getAccountId(request)
    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { threadId, contactEmail, subject, body: emailBody, isAiGenerated, aiPrompt } = body

    if (!threadId || !contactEmail || !subject || !emailBody) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the last message ID from the thread
    const lastMessages = await sql`
      SELECT outlook_message_id
      FROM email_messages
      WHERE thread_id = ${threadId} AND account_id = ${accountId}
      ORDER BY COALESCE(sent_at, received_at, created_at) DESC
      LIMIT 1
    `

    const lastMessageId = lastMessages.length > 0 ? lastMessages[0].outlook_message_id : ""

    if (!lastMessageId) {
      return NextResponse.json({ error: "No message found in thread" }, { status: 404 })
    }

    // Send reply via Outlook
    const result = await sendOutlookReply({
      accountId,
      messageId: lastMessageId,
      to: contactEmail,
      subject,
      body: emailBody,
      isHtml: true,
    })

    const now = new Date().toISOString()

    // Store the reply
    await sql`
      INSERT INTO email_messages (
        account_id, thread_id, outlook_message_id, direction,
        from_email, to_email, subject, body, html_body,
        is_ai_generated, ai_prompt, sent_at
      )
      VALUES (
        ${accountId}, ${threadId}, ${result.messageId}, 'sent',
        '', ${contactEmail}, ${subject}, ${emailBody}, ${emailBody},
        ${isAiGenerated || false}, ${aiPrompt || null}, ${now}
      )
    `

    // Update thread
    await sql`
      UPDATE email_threads
      SET 
        message_count = message_count + 1,
        last_message_at = ${now},
        updated_at = ${now}
      WHERE id = ${threadId} AND account_id = ${accountId}
    `

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("[v0] [OUTLOOK-REPLY] Error:", error)
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 })
  }
}
