import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sendOutlookEmail } from "@/lib/outlook-mail"
import { getAccountId } from "@/lib/rls-helper"

export async function POST(request: Request) {
  try {
    const accountId = await getAccountId(request)
    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { contactIds } = body

    console.log("[v0] [OUTLOOK-SEND] Email send request for contacts:", contactIds)

    if (!contactIds || !Array.isArray(contactIds)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    const results = []
    for (const contactId of contactIds) {
      try {
        const contacts = await sql`
          SELECT * FROM contacts 
          WHERE id = ${contactId} 
            AND account_id = ${accountId}
            AND (status = 'generated' OR status = 'failed')
        `

        if (contacts.length === 0) {
          results.push({ contactId, success: false, error: "Contact not found or not ready" })
          continue
        }

        const contact = contacts[0]
        console.log("[v0] [OUTLOOK-SEND] Sending email to:", contact.email)

        const emailResult = await sendOutlookEmail({
          accountId,
          to: contact.email,
          subject: contact.subject,
          body: contact.body,
          isHtml: true,
        })

        const now = new Date().toISOString()

        // Create thread
        const threadResult = await sql`
          INSERT INTO email_threads (
            contact_id, campaign_id, subject, status,
            message_count, last_message_at, account_id
          )
          VALUES (
            ${contactId}, ${contact.campaign_id}, ${contact.subject}, 'active',
            1, ${now}, ${accountId}
          )
          RETURNING id
        `

        const threadId = threadResult[0].id

        // Store message
        await sql`
          INSERT INTO email_messages (
            account_id, thread_id, contact_id, outlook_message_id, 
            direction, from_email, to_email, subject, body, html_body, sent_at
          )
          VALUES (
            ${accountId}, ${threadId}, ${contactId}, ${emailResult.messageId},
            'sent', '', ${contact.email}, ${contact.subject}, ${contact.body}, 
            ${contact.body}, ${now}
          )
        `

        // Update contact
        await sql`
          UPDATE contacts
          SET 
            status = 'sent',
            sent_at = ${now},
            failed_reason = NULL,
            thread_id = ${threadId},
            outlook_message_id = ${emailResult.messageId},
            updated_at = ${now}
          WHERE id = ${contactId}
        `

        results.push({ contactId, success: true })
      } catch (error) {
        console.error(`[v0] [OUTLOOK-SEND] Failed for contact ${contactId}:`, error)

        await sql`
          UPDATE contacts
          SET status = 'failed', failed_reason = ${String(error)}
          WHERE id = ${contactId}
        `

        results.push({ contactId, success: false, error: String(error) })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("[v0] [OUTLOOK-SEND] Error:", error)
    return NextResponse.json({ error: "Failed to send emails" }, { status: 500 })
  }
}
