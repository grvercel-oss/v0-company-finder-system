import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountId } from "@/lib/rls-helper"
import { getEmailProvider } from "@/lib/email-provider"

export async function POST(request: Request) {
  try {
    const accountId = await getAccountId(request)
    const providerConfig = await getEmailProvider(accountId)

    if (!providerConfig) {
      return NextResponse.json({ error: "Email provider not connected for this account" }, { status: 400 })
    }

    console.log(`[v0] [MAIL] Checking for email replies using provider: ${providerConfig.provider}`)

    const threads = await sql`
      SELECT DISTINCT t.id as thread_id
      FROM email_threads t
      WHERE t.account_id = ${accountId}
        AND t.status IN ('active', 'sent', 'replied')
    `

    console.log(`[v0] [MAIL] Found ${threads.length} threads to check`)

    if (threads.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        repliesFound: 0,
        provider: providerConfig.provider,
      })
    }

    const threadIds = threads.map((t) => t.thread_id)

    let result
    if (providerConfig.provider === "outlook") {
      result = await checkOutlookReplies(accountId, threadIds)
    } else if (providerConfig.provider === "zoho") {
      result = await checkZohoReplies(accountId, threadIds, providerConfig.settings)
    } else {
      return NextResponse.json({ error: `Unknown provider: ${providerConfig.provider}` }, { status: 400 })
    }

    console.log(`[v0] [MAIL] ✅ Reply check complete. Total replies found: ${result.repliesFound}`)

    return NextResponse.json({
      success: true,
      checked: result.checked,
      repliesFound: result.repliesFound,
      provider: providerConfig.provider,
    })
  } catch (error) {
    console.error("[v0] [MAIL] Error checking replies:", error)
    return NextResponse.json(
      {
        error: "Failed to check replies",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

async function checkOutlookReplies(accountId: string, threadIds: number[]) {
  try {
    const { getOutlookMessages, isOutlookReply } = await import("@/lib/outlook-mail")

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentMessages = await getOutlookMessages(accountId, thirtyDaysAgo, 200)

    console.log(`[v0] [MAIL] Fetched ${recentMessages.length} recent Outlook messages`)

    const sentContacts = await sql`
      SELECT 
        c.id, c.email, c.sent_at, c.campaign_id, c.subject,
        t.id as existing_thread_id
      FROM contacts c
      LEFT JOIN email_threads t ON c.thread_id = t.id
      WHERE c.thread_id = ANY(${threadIds})
        AND c.status IN ('sent', 'replied')
        AND c.sent_at IS NOT NULL
      ORDER BY c.sent_at DESC
    `

    console.log(`[v0] [MAIL] Found ${sentContacts.length} Outlook contacts to check`)

    const contactMap = new Map()
    for (const contact of sentContacts) {
      const normalizedEmail = contact.email.toLowerCase().trim()
      contactMap.set(normalizedEmail, contact)
    }

    let repliesFound = 0
    const processedThreads = new Set()

    for (const message of recentMessages) {
      try {
        const fromEmail = message.from?.emailAddress?.address?.toLowerCase().trim()

        if (!fromEmail) {
          console.log(`[v0] [MAIL] Skipping message - no from email`)
          continue
        }

        const contact = contactMap.get(fromEmail)

        if (!contact) continue

        const messageTime = new Date(message.receivedDateTime)
        const sentTime = new Date(contact.sent_at)

        if (messageTime <= sentTime) continue
        if (processedThreads.has(contact.id)) continue

        const replyInfo = isOutlookReply(message)
        if (!replyInfo.isReply) continue

        const existingReply = await sql`
          SELECT id FROM replies
          WHERE outlook_message_id = ${message.internetMessageId || message.id}
          LIMIT 1
        `.catch((err) => {
          console.error(`[v0] [MAIL] Error checking existing reply:`, err)
          return []
        })

        if (existingReply.length > 0) continue

        console.log(`[v0] [MAIL] Found NEW Outlook reply from ${fromEmail}`)

        let threadId = contact.existing_thread_id

        if (!threadId) {
          try {
            const threadResult = await sql`
              INSERT INTO email_threads (
                account_id, contact_id, campaign_id, thread_id, subject, status,
                has_unread_replies, message_count, reply_count,
                last_message_at, last_reply_at
              )
              VALUES (
                ${accountId}, ${contact.id}, ${contact.campaign_id}, 
                ${message.conversationId || message.internetMessageId || message.id},
                ${message.subject}, 'replied',
                true, 2, 1, ${messageTime.toISOString()}, ${messageTime.toISOString()}
              )
              RETURNING id
            `
            threadId = threadResult[0].id

            await sql`
              UPDATE contacts
              SET thread_id = ${threadId}, status = 'replied', reply_received_at = ${messageTime.toISOString()}
              WHERE id = ${contact.id}
            `
          } catch (err) {
            console.error(`[v0] [MAIL] Error creating thread for contact ${contact.id}:`, err)
            continue
          }
        } else {
          try {
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
              UPDATE contacts
              SET status = 'replied', reply_received_at = ${messageTime.toISOString()}
              WHERE id = ${contact.id}
            `
          } catch (err) {
            console.error(`[v0] [MAIL] Error updating thread ${threadId}:`, err)
            continue
          }
        }

        const toEmail = message.toRecipients?.[0]?.emailAddress?.address || contact.email

        try {
          await sql`
            INSERT INTO replies (
              account_id, contact_id,
              thread_id,
              message_id,
              outlook_message_id,
              subject,
              from_email,
              from_name,
              received_at,
              body_text,
              body_html,
              in_reply_to,
              email_references,
              processed
            ) VALUES (
              ${accountId}, ${contact.id},
              ${String(threadId)},
              ${message.internetMessageId || message.id},
              ${message.internetMessageId || message.id},
              ${message.subject},
              ${fromEmail},
              ${message.from.emailAddress.name || fromEmail.split("@")[0]},
              ${messageTime.toISOString()},
              ${message.body.content || ""},
              ${message.body.contentType === "html" ? message.body.content : ""},
              ${replyInfo.inReplyTo || ""},
              ${replyInfo.references || ""},
              false
            )
            ON CONFLICT (outlook_message_id) DO NOTHING
          `

          await sql`
            INSERT INTO email_messages (
              account_id, thread_id, direction,
              from_email, from_name, to_email, subject, body, html_body,
              is_read, received_at, outlook_message_id, message_id, provider
            )
            VALUES (
              ${accountId}, ${threadId}, 'received',
              ${fromEmail}, 
              ${message.from.emailAddress.name || fromEmail.split("@")[0]}, 
              ${toEmail}, 
              ${message.subject},
              ${message.body.content || ""}, 
              ${message.body.contentType === "html" ? message.body.content : ""},
              false, 
              ${messageTime.toISOString()}, 
              ${message.internetMessageId || message.id},
              ${message.internetMessageId || message.id},
              'outlook'
            )
            ON CONFLICT (message_id) DO NOTHING
          `

          console.log(`[v0] [MAIL] ✅ Saved Outlook reply to database`)

          repliesFound++
          processedThreads.add(contact.id)
        } catch (err) {
          console.error(`[v0] [MAIL] Error saving reply for contact ${contact.id}:`, err)
        }
      } catch (error) {
        console.error(`[v0] [MAIL] Error processing Outlook message:`, error)
        // Continue processing other messages
      }
    }

    return {
      checked: recentMessages.length,
      repliesFound,
    }
  } catch (error) {
    console.error(`[v0] [MAIL] Fatal error in checkOutlookReplies:`, error)
    throw error
  }
}

async function checkZohoReplies(accountId: string, threadIds: number[], settings: any) {
  try {
    const { fetchInboxMessages } = await import("@/lib/zoho-mail")

    console.log("[v0] [MAIL] Provider settings:", JSON.stringify(settings, null, 2))

    const recentMessages = await fetchInboxMessages(settings, {
      daysBack: 30,
      limit: 200,
    })

    console.log(`[v0] [MAIL] Fetched ${recentMessages.length} inbox messages from Zoho`)

    const sentContacts = await sql`
      SELECT 
        c.id, c.email, c.sent_at, c.campaign_id, c.subject,
        t.id as existing_thread_id
      FROM contacts c
      LEFT JOIN email_threads t ON c.thread_id = t.id
      WHERE c.thread_id = ANY(${threadIds})
        AND c.status IN ('sent', 'replied')
        AND c.sent_at IS NOT NULL
      ORDER BY c.sent_at DESC
    `

    console.log(`[v0] [MAIL] Found ${sentContacts.length} Zoho contacts to check`)

    const contactMap = new Map()
    for (const contact of sentContacts) {
      const normalizedEmail = contact.email.toLowerCase().trim()
      contactMap.set(normalizedEmail, contact)
    }

    console.log("[v0] [MAIL] Contact emails to match:", Array.from(contactMap.keys()).join(", "))

    const userEmails = new Set<string>()
    if (settings.email) {
      userEmails.add(settings.email.toLowerCase().trim())
    }

    let repliesFound = 0
    const processedThreads = new Set()

    for (const message of recentMessages) {
      try {
        const fromEmail = message.fromAddress

        if (!fromEmail) {
          console.log(`[v0] [MAIL] Skipping message ${message.messageId} - no from email`)
          continue
        }

        if (userEmails.has(fromEmail)) {
          console.log(`[v0] [MAIL] Skipping message ${message.messageId} - from user (${fromEmail})`)
          continue
        }

        const contact = contactMap.get(fromEmail)

        if (!contact) {
          continue
        }

        console.log(`[v0] [MAIL] Found message from tracked contact: ${fromEmail}`)

        const messageTime = new Date(message.time)
        const sentTime = new Date(contact.sent_at)

        if (messageTime <= sentTime) {
          console.log(`[v0] [MAIL] Skipping - message received before we sent (${messageTime} <= ${sentTime})`)
          continue
        }

        if (processedThreads.has(contact.id)) {
          continue
        }

        const existingReply = await sql`
          SELECT id FROM replies
          WHERE zoho_message_id = ${message.messageId}
          LIMIT 1
        `.catch((err) => {
          console.error(`[v0] [MAIL] Error checking existing reply:`, err)
          return []
        })

        if (existingReply.length > 0) {
          console.log(`[v0] [MAIL] Reply already exists for message ${message.messageId}`)
          continue
        }

        console.log(`[v0] [MAIL] ✨ Found NEW Zoho reply from ${fromEmail} for contact ${contact.id}`)

        let threadId = contact.existing_thread_id

        if (!threadId) {
          try {
            const threadResult = await sql`
              INSERT INTO email_threads (
                account_id, contact_id, campaign_id, thread_id, subject, status,
                has_unread_replies, message_count, reply_count,
                last_message_at, last_reply_at
              )
              VALUES (
                ${accountId}, ${contact.id}, ${contact.campaign_id}, 
                ${message.threadId || message.messageId},
                ${contact.subject || message.subject}, 'replied',
                true, 2, 1,
                ${messageTime.toISOString()}, ${messageTime.toISOString()}
              )
              RETURNING id
            `
            threadId = threadResult[0].id

            await sql`
              UPDATE contacts
              SET thread_id = ${threadId}, status = 'replied', reply_received_at = ${messageTime.toISOString()}
              WHERE id = ${contact.id}
            `

            console.log(`[v0] [MAIL] Created new thread ${threadId} for contact ${contact.id}`)
          } catch (err) {
            console.error(`[v0] [MAIL] Error creating thread for contact ${contact.id}:`, err)
            continue
          }
        } else {
          try {
            await sql`
              UPDATE email_threads
              SET 
                has_unread_replies = true,
                reply_count = reply_count + 1,
                message_count = message_count + 1,
                last_message_at = ${messageTime.toISOString()},
                last_reply_at = ${messageTime.toISOString()},
                status = 'replied',
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${threadId}
            `

            await sql`
              UPDATE contacts
              SET status = 'replied', reply_received_at = ${messageTime.toISOString()}
              WHERE id = ${contact.id}
            `

            console.log(`[v0] [MAIL] Updated existing thread ${threadId} for contact ${contact.id}`)
          } catch (err) {
            console.error(`[v0] [MAIL] Error updating thread ${threadId}:`, err)
            continue
          }
        }

        try {
          await sql`
            INSERT INTO replies (
              account_id, contact_id,
              thread_id,
              message_id,
              zoho_message_id,
              subject,
              from_email,
              from_name,
              received_at,
              body_text,
              body_html,
              processed
            ) VALUES (
              ${accountId}, ${contact.id},
              ${String(threadId)},
              ${message.messageId},
              ${message.messageId},
              ${message.subject},
              ${fromEmail},
              ${message.sender || fromEmail.split("@")[0]},
              ${messageTime.toISOString()},
              ${message.summary || message.content || ""},
              ${message.content || ""},
              false
            )
            ON CONFLICT (zoho_message_id) DO NOTHING
          `

          await sql`
            INSERT INTO email_messages (
              account_id, thread_id, direction,
              from_email, from_name, to_email, subject, body, html_body,
              is_read, received_at, zoho_message_id, message_id, provider
            )
            VALUES (
              ${accountId}, ${threadId}, 'received',
              ${fromEmail}, 
              ${message.sender || fromEmail.split("@")[0]}, 
              ${message.toAddress || contact.email}, 
              ${message.subject},
              ${message.summary || message.content || ""}, 
              ${message.content || ""},
              ${message.isRead || false}, 
              ${messageTime.toISOString()}, 
              ${message.messageId},
              ${message.messageId},
              'zoho'
            )
            ON CONFLICT (message_id) DO NOTHING
          `

          console.log(`[v0] [MAIL] ✅ Saved Zoho reply to database`)

          repliesFound++
          processedThreads.add(contact.id)
        } catch (err) {
          console.error(`[v0] [MAIL] Error saving reply for contact ${contact.id}:`, err)
        }
      } catch (error) {
        console.error(`[v0] [MAIL] Error processing Zoho message ${message.messageId}:`, error)
        // Continue processing other messages
      }
    }

    console.log(`[v0] [MAIL] Zoho reply check complete: ${repliesFound} new replies found`)

    return {
      checked: recentMessages.length,
      repliesFound,
    }
  } catch (error) {
    console.error(`[v0] [MAIL] Fatal error in checkZohoReplies:`, error)
    throw error
  }
}
