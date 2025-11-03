import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sendReply } from "@/lib/zoho-mail"
import { sendOutlookReply } from "@/lib/outlook-mail"
import { getAccountId } from "@/lib/rls-helper"
import { getEmailProvider } from "@/lib/email-provider"

export async function POST(request: Request) {
  try {
    const accountId = await getAccountId(request)

    const body = await request.json()
    const { threadId, contactEmail, subject, body: emailBody, isAiGenerated, aiPrompt } = body

    if (!threadId || !contactEmail || !subject || !emailBody) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const providerConfig = await getEmailProvider(accountId)

    if (!providerConfig) {
      return NextResponse.json({ error: "Email provider not connected for this account" }, { status: 400 })
    }

    const provider = providerConfig.provider
    console.log("[v0] [REPLY] Using provider:", provider)

    const lastMessages = await sql`
      SELECT message_id, zoho_message_id, outlook_message_id
      FROM email_messages
      WHERE thread_id = ${threadId}
      ORDER BY COALESCE(sent_at, received_at, created_at) DESC
      LIMIT 1
    `

    let result: any
    let messageId: string
    let internetMessageId: string | null = null

    if (provider === "zoho") {
      const lastMessageId = lastMessages.length > 0 ? lastMessages[0].zoho_message_id || lastMessages[0].message_id : ""

      result = await sendReply({
        messageId: lastMessageId,
        to: contactEmail,
        subject,
        body: emailBody,
      })

      console.log("[v0] [REPLY] Zoho reply sent successfully:", result)
      messageId = result.data?.messageId || `sent-${Date.now()}`
    } else {
      const lastOutlookMessageId = lastMessages.length > 0 ? lastMessages[0].outlook_message_id : null

      if (!lastOutlookMessageId) {
        return NextResponse.json({ error: "Cannot find original message to reply to" }, { status: 400 })
      }

      result = await sendOutlookReply({
        accountId,
        messageId: lastOutlookMessageId,
        to: contactEmail,
        subject,
        body: emailBody,
      })

      console.log("[v0] [REPLY] Outlook reply sent successfully:", result)
      messageId = result.messageId
      internetMessageId = result.internetMessageId || null
    }

    const now = new Date().toISOString()

    if (provider === "zoho") {
      await sql`
        INSERT INTO email_messages (
          thread_id, message_id, zoho_message_id, direction,
          from_email, to_email, subject, body, html_body,
          is_ai_generated, ai_prompt, sent_at, account_id, provider
        )
        VALUES (
          ${threadId}, ${messageId}, ${messageId}, 'sent',
          ${result.data?.fromAddress || ""}, ${contactEmail}, ${subject}, ${emailBody}, ${emailBody},
          ${isAiGenerated || false}, ${aiPrompt || null}, ${now}, ${accountId}, 'zoho'
        )
      `
    } else {
      await sql`
        INSERT INTO email_messages (
          thread_id, message_id, outlook_message_id, direction,
          from_email, to_email, subject, body, html_body,
          is_ai_generated, ai_prompt, sent_at, account_id, provider
        )
        VALUES (
          ${threadId}, ${messageId}, ${internetMessageId}, 'sent',
          '', ${contactEmail}, ${subject}, ${emailBody}, ${emailBody},
          ${isAiGenerated || false}, ${aiPrompt || null}, ${now}, ${accountId}, 'outlook'
        )
      `
    }

    await sql`
      UPDATE email_threads
      SET 
        message_count = message_count + 1,
        last_message_at = ${now},
        updated_at = ${now}
      WHERE id = ${threadId}
    `

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("[v0] [REPLY] Error sending reply:", error)
    return NextResponse.json({ error: "Failed to send reply", details: String(error) }, { status: 500 })
  }
}
