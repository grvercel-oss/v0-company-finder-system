import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sendEmail } from "@/lib/zoho-oauth"
import { sendOutlookEmail } from "@/lib/outlook-mail"
import { getAccountId } from "@/lib/rls-helper"
import { getEmailProvider } from "@/lib/email-provider"

export async function POST(request: Request) {
  try {
    const accountId = await getAccountId(request)

    const body = await request.json()
    const { contactIds } = body

    console.log("[v0] [SEND] Received request to send emails to contacts:", contactIds)
    console.log("[v0] [SEND] Using account_id:", accountId)

    if (!contactIds || !Array.isArray(contactIds)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    const providerConfig = await getEmailProvider(accountId)

    if (!providerConfig) {
      return NextResponse.json({ error: "No mail provider configured" }, { status: 400 })
    }

    const provider = providerConfig.provider
    console.log("[v0] [SEND] Using provider:", provider)

    const results = []
    for (const contactId of contactIds) {
      try {
        console.log("[v0] [SEND] Processing contact:", contactId)

        const contacts = await sql`
          SELECT * FROM contacts 
          WHERE id = ${contactId}
        `

        console.log("[v0] [SEND] Contact check (no account filter):", {
          found: contacts.length > 0,
          contactId,
          accountId: contacts[0]?.account_id,
          email: contacts[0]?.email,
        })

        if (contacts.length === 0) {
          console.log("[v0] [SEND] Contact not found:", contactId)
          results.push({ contactId, success: false, error: "Contact not found" })
          continue
        }

        const contact = contacts[0]
        console.log("[v0] [SEND] Sending via", provider, "to:", contact.email)

        let emailResult: any
        let messageId: string
        let internetMessageId: string | null = null

        if (provider === "zoho") {
          console.log("[v0] [SEND] Sending via Zoho...")
          emailResult = await sendEmail({
            to: contact.email,
            subject: contact.subject,
            body: contact.body,
          })
          messageId = emailResult.data?.messageId || `sent-${Date.now()}-${contactId}`
          console.log("[v0] [SEND] Zoho send result:", { messageId })
        } else {
          console.log("[v0] [SEND] Sending via Outlook...")
          console.log("[v0] [SEND] Email details:", {
            to: contact.email,
            subject: contact.subject,
            bodyLength: contact.body?.length,
          })

          emailResult = await sendOutlookEmail({
            accountId,
            to: contact.email,
            subject: contact.subject,
            body: contact.body,
            isHtml: true,
          })
          messageId = emailResult.messageId
          internetMessageId = emailResult.internetMessageId || null
          console.log("[v0] [SEND] Outlook send result:", {
            messageId,
            internetMessageId,
            conversationId: emailResult.conversationId,
          })
        }

        const now = new Date().toISOString()

        const threadResult = await sql`
          INSERT INTO email_threads (
            contact_id, campaign_id, thread_id, subject, status,
            message_count, last_message_at, account_id
          )
          VALUES (
            ${contactId}, ${contact.campaign_id}, 
            ${provider === "zoho" ? messageId : internetMessageId || messageId}, 
            ${contact.subject}, 'active',
            1, ${now}, ${accountId}
          )
          RETURNING id
        `

        const threadId = threadResult[0].id
        console.log("[v0] [SEND] Created email thread:", threadId)

        if (provider === "zoho") {
          await sql`
            INSERT INTO email_messages (
              thread_id, message_id, zoho_message_id, direction,
              from_email, to_email, subject, body, html_body,
              sent_at, account_id, provider
            )
            VALUES (
              ${threadId}, ${messageId}, ${messageId}, 'sent',
              ${emailResult.data?.fromAddress || ""}, ${contact.email}, 
              ${contact.subject}, ${contact.body}, ${contact.body},
              ${now}, ${accountId}, 'zoho'
            )
          `

          await sql`
            UPDATE contacts
            SET 
              status = 'sent',
              sent_at = ${now},
              failed_reason = NULL,
              thread_id = ${threadId},
              zoho_message_id = ${messageId},
              account_id = ${accountId},
              updated_at = ${now}
            WHERE id = ${contactId}
          `
        } else {
          await sql`
            INSERT INTO email_messages (
              thread_id, message_id, outlook_message_id, direction,
              from_email, to_email, subject, body, html_body,
              sent_at, account_id, provider
            )
            VALUES (
              ${threadId}, ${messageId}, ${internetMessageId}, 'sent',
              '', ${contact.email}, 
              ${contact.subject}, ${contact.body}, ${contact.body},
              ${now}, ${accountId}, 'outlook'
            )
          `

          await sql`
            UPDATE contacts
            SET 
              status = 'sent',
              sent_at = ${now},
              failed_reason = NULL,
              thread_id = ${threadId},
              outlook_message_id = ${internetMessageId},
              account_id = ${accountId},
              updated_at = ${now}
            WHERE id = ${contactId}
          `
        }

        console.log("[v0] [SEND] ✅ Successfully sent email via", provider, "to contact:", contactId)
        results.push({ contactId, success: true })
      } catch (error) {
        console.error(`[v0] [SEND] Failed to send email to contact ${contactId}:`, error)

        const now = new Date().toISOString()

        try {
          await sql`
            UPDATE contacts
            SET 
              status = 'failed',
              failed_reason = ${String(error)},
              account_id = ${accountId},
              updated_at = ${now}
            WHERE id = ${contactId}
          `
        } catch (updateError) {
          console.error(`[v0] [SEND] Failed to update contact ${contactId} status:`, updateError)
        }

        results.push({ contactId, success: false, error: String(error) })
      }
    }

    const hasFailures = results.some((r) => r.success === false)
    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    console.log("[v0] [SEND] Batch complete:", {
      total: results.length,
      success: successCount,
      failed: failureCount,
    })

    if (hasFailures) {
      return NextResponse.json({ results }, { status: 207 })
    }

    return NextResponse.json({ results }, { status: 200 })
  } catch (error) {
    console.error("[v0] [SEND] Error sending emails:", error)
    return NextResponse.json({ error: "Failed to send emails", details: String(error) }, { status: 500 })
  }
}
