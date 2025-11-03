import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getOutlookMessages, isOutlookReply } from "@/lib/outlook-mail"
import { getAccountId } from "@/lib/rls-helper"

export async function POST(request: Request) {
  try {
    const accountId = await getAccountId(request)

    console.log("[v0] Checking for email replies...")

    const sentMessages = await sql`
      SELECT 
        em.id,
        em.outlook_message_id,
        em.thread_id,
        em.to_email,
        em.subject,
        et.contact_id,
        c.email as contact_email,
        c.first_name,
        c.last_name,
        c.account_id
      FROM email_messages em
      JOIN email_threads et ON em.thread_id = et.id
      JOIN contacts c ON et.contact_id = c.id
      WHERE (em.account_id = ${accountId} OR ${accountId} IS NULL)
        AND em.direction = 'sent'
        AND em.outlook_message_id IS NOT NULL
        AND em.sent_at > NOW() - INTERVAL '30 days'
      ORDER BY em.sent_at DESC
    `

    console.log(`[v0] Found ${sentMessages.length} sent messages with Message-IDs to check`)

    if (sentMessages.length === 0) {
      const allMessages = await sql`
        SELECT COUNT(*) as count FROM email_messages 
        WHERE account_id = ${accountId} OR ${accountId} IS NULL
      `
      const sentCount = await sql`
        SELECT COUNT(*) as count FROM email_messages 
        WHERE (account_id = ${accountId} OR ${accountId} IS NULL) AND direction = 'sent'
      `
      const withMessageId = await sql`
        SELECT COUNT(*) as count FROM email_messages 
        WHERE (account_id = ${accountId} OR ${accountId} IS NULL) AND outlook_message_id IS NOT NULL
      `

      const sampleMessages = await sql`
        SELECT id, direction, outlook_message_id, sent_at, account_id
        FROM email_messages 
        WHERE account_id = ${accountId} OR ${accountId} IS NULL
        ORDER BY sent_at DESC
        LIMIT 5
      `

      console.log(`[v0] Debug - Total messages: ${allMessages[0]?.count || 0}`)
      console.log(`[v0] Debug - Sent messages: ${sentCount[0]?.count || 0}`)
      console.log(`[v0] Debug - Messages with outlook_message_id: ${withMessageId[0]?.count || 0}`)
      console.log(`[v0] Debug - Sample messages:`, JSON.stringify(sampleMessages, null, 2))

      return NextResponse.json({
        success: true,
        checked: 0,
        repliesFound: 0,
        message: "No sent messages found with Message-IDs",
        debug: {
          totalMessages: allMessages[0]?.count || 0,
          sentMessages: sentCount[0]?.count || 0,
          withMessageId: withMessageId[0]?.count || 0,
          sampleMessages: sampleMessages,
        },
      })
    }

    const messageIdMap = new Map()
    const contactEmailMap = new Map()

    for (const msg of sentMessages) {
      if (msg.outlook_message_id) {
        messageIdMap.set(msg.outlook_message_id, msg)
      }
      if (msg.contact_email) {
        const normalizedEmail = msg.contact_email.toLowerCase().trim()
        contactEmailMap.set(normalizedEmail, msg)
      }
    }

    console.log(`[v0] Created lookup maps - Message-IDs: ${messageIdMap.size}, Emails: ${contactEmailMap.size}`)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentMessages = await getOutlookMessages(accountId, thirtyDaysAgo, 200)

    console.log(`[v0] Fetched ${recentMessages.length} recent Outlook messages`)

    let repliesFound = 0
    const processedMessageIds = new Set()

    for (const message of recentMessages) {
      try {
        const messageId = message.internetMessageId || message.id

        if (processedMessageIds.has(messageId)) {
          continue
        }

        const replyInfo = isOutlookReply(message)
        const inReplyTo = replyInfo.inReplyTo

        console.log(`[v0] Processing message:`, {
          subject: message.subject,
          from: message.from?.emailAddress?.address,
          inReplyTo: inReplyTo,
          hasReplyHeader: !!inReplyTo,
        })

        let matchedMessage = null

        if (inReplyTo) {
          matchedMessage = messageIdMap.get(inReplyTo)
          if (matchedMessage) {
            console.log(`[v0] ✅ MATCHED by Message-ID! In-Reply-To: ${inReplyTo}`)
            console.log(
              `[v0] Matched to contact: ${matchedMessage.first_name} ${matchedMessage.last_name} (${matchedMessage.contact_email})`,
            )
          }
        }

        if (!matchedMessage) {
          const fromEmail = message.from?.emailAddress?.address?.toLowerCase()?.trim()
          const senderEmail = message.sender?.emailAddress?.address?.toLowerCase()?.trim()

          if (fromEmail) {
            matchedMessage = contactEmailMap.get(fromEmail)
            if (matchedMessage) {
              console.log(`[v0] ✅ MATCHED by email address: ${fromEmail}`)
            }
          }

          if (!matchedMessage && senderEmail) {
            matchedMessage = contactEmailMap.get(senderEmail)
            if (matchedMessage) {
              console.log(`[v0] ✅ MATCHED by sender email: ${senderEmail}`)
            }
          }
        }

        if (!matchedMessage) {
          console.log(`[v0] No match found for this message`)
          continue
        }

        const existingReply = await sql`
          SELECT id FROM replies
          WHERE outlook_message_id = ${messageId}
          LIMIT 1
        `

        if (existingReply.length > 0) {
          console.log(`[v0] Reply already exists in database, skipping`)
          continue
        }

        const messageTime = new Date(message.receivedDateTime)
        const threadId = matchedMessage.thread_id
        const contactId = matchedMessage.contact_id

        console.log(`[v0] Saving reply to thread ${threadId}, contact ${contactId}`)

        console.log(`[v0] [DEBUG] threadId type: ${typeof threadId}, value: ${threadId}`)

        await sql`
          UPDATE email_threads
          SET 
            has_unread_replies = true,
            reply_count = reply_count + 1,
            message_count = message_count + 1,
            last_message_at = ${messageTime.toISOString()},
            last_reply_at = ${messageTime.toISOString()},
            status = 'replied'
          WHERE id = ${threadId}
        `

        await sql`
          INSERT INTO replies (
            account_id, contact_id, thread_id, message_id,
            outlook_message_id, zoho_message_id, in_reply_to, subject, from_email, from_name, 
            received_at, body_text, body_html, processed
          ) VALUES (
            ${accountId}, ${contactId}, ${threadId}, ${message.id},
            ${messageId}, '', ${inReplyTo || null}, ${message.subject}, 
            ${message.from.emailAddress.address}, 
            ${message.from.emailAddress.name || ""},
            ${messageTime.toISOString()}, 
            ${message.body?.content || ""}, 
            ${message.body?.contentType === "html" ? message.body.content : ""}, 
            false
          )
          ON CONFLICT (outlook_message_id) DO NOTHING
        `

        const toEmail = message.toRecipients?.[0]?.emailAddress?.address || ""

        console.log(`[v0] [DEBUG] Inserting into email_messages with thread_id: ${threadId} (type: ${typeof threadId})`)

        await sql`
          INSERT INTO email_messages (
            account_id, thread_id, direction,
            from_email, from_name, to_email, subject, body, html_body,
            is_read, received_at, outlook_message_id
          )
          VALUES (
            ${accountId}, ${threadId}, 'received',
            ${message.from.emailAddress.address}, 
            ${message.from.emailAddress.name || ""}, 
            ${toEmail}, ${message.subject},
            ${message.body?.content || ""}, 
            ${message.body?.contentType === "html" ? message.body.content : ""},
            false, ${messageTime.toISOString()}, ${messageId}
          )
        `

        const verifyInsert = await sql`
          SELECT id, thread_id, direction, from_email, subject
          FROM email_messages
          WHERE outlook_message_id = ${messageId}
          LIMIT 1
        `
        console.log(`[v0] [DEBUG] Verified insert:`, JSON.stringify(verifyInsert, null, 2))

        repliesFound++
        processedMessageIds.add(messageId)

        console.log(`[v0] ✅ Successfully saved reply from ${message.from.emailAddress.address}`)
      } catch (error) {
        console.error(`[v0] Error processing message:`, error)
      }
    }

    console.log(`[v0] Reply check complete. Found ${repliesFound} new replies`)

    return NextResponse.json({
      success: true,
      checked: recentMessages.length,
      repliesFound,
      sentMessagesChecked: sentMessages.length,
    })
  } catch (error) {
    console.error("[v0] Error checking replies:", error)
    return NextResponse.json(
      {
        error: "Failed to check replies",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
