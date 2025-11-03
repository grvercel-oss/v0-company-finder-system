import { sql } from "@/lib/db"
import { getOutlookMessages, isOutlookReply } from "@/lib/outlook-mail"
import { getLastChecked, setLastChecked } from "@/lib/redis"

export async function syncOutlookEmailsForAccount(accountId: string): Promise<number> {
  try {
    console.log(`[v0] [OUTLOOK-SYNC] Syncing emails for account: ${accountId}`)

    // Get last checked timestamp from Redis
    const lastChecked = await getLastChecked(`outlook-${accountId}`)
    const lastCheckedDate = new Date(lastChecked)

    console.log(`[v0] [OUTLOOK-SYNC] Last checked: ${lastCheckedDate.toISOString()}`)

    // Fetch new emails from Outlook
    const newEmails = await getOutlookMessages(accountId, lastCheckedDate, 100)

    console.log(`[v0] [OUTLOOK-SYNC] Found ${newEmails.length} new emails`)

    // Process each email and detect replies
    let repliesDetected = 0
    for (const email of newEmails) {
      const isReply = await detectAndStoreOutlookReply(email, accountId)
      if (isReply) repliesDetected++
    }

    // Update last checked timestamp
    await setLastChecked(`outlook-${accountId}`, Date.now())

    console.log(`[v0] [OUTLOOK-SYNC] Detected ${repliesDetected} replies`)
    return repliesDetected
  } catch (error) {
    console.error(`[v0] [OUTLOOK-SYNC] Error syncing emails for account ${accountId}:`, error)
    throw error
  }
}

async function detectAndStoreOutlookReply(email: any, accountId: string): Promise<boolean> {
  try {
    // Check if this email is a reply
    const replyInfo = isOutlookReply(email)

    if (!replyInfo.isReply) {
      return false
    }

    const { inReplyTo, references } = replyInfo

    // Check if we have a sent message with matching message ID
    const sentMessage = await sql`
      SELECT 
        em.id,
        em.thread_id,
        em.contact_id,
        c.email as contact_email
      FROM email_messages em
      LEFT JOIN contacts c ON em.contact_id = c.id
      WHERE em.account_id = ${accountId}
        AND em.direction = 'sent'
        AND (
          em.outlook_message_id = ${inReplyTo}
          OR em.outlook_message_id = ANY(string_to_array(${references || ""}, ' '))
        )
      LIMIT 1
    `

    if (sentMessage.length === 0) {
      return false
    }

    const originalMessage = sentMessage[0]
    const messageTime = new Date(email.receivedDateTime)

    // Check if reply already exists
    const existingReply = await sql`
      SELECT id FROM replies
      WHERE account_id = ${accountId}
        AND outlook_message_id = ${email.internetMessageId || email.id}
      LIMIT 1
    `

    if (existingReply.length > 0) {
      return false
    }

    // Store the reply
    await sql`
      INSERT INTO replies (
        account_id,
        contact_id,
        thread_id,
        message_id,
        outlook_message_id,
        in_reply_to,
        email_references,
        subject,
        from_email,
        from_name,
        received_at,
        body_text,
        body_html,
        processed
      ) VALUES (
        ${accountId},
        ${originalMessage.contact_id},
        ${originalMessage.thread_id || email.conversationId},
        ${email.id},
        ${email.internetMessageId || email.id},
        ${inReplyTo},
        ${references},
        ${email.subject},
        ${email.from.emailAddress.address},
        ${email.from.emailAddress.name || email.from.emailAddress.address},
        ${messageTime.toISOString()},
        ${email.body.content},
        ${email.body.contentType === "html" ? email.body.content : ""},
        false
      )
    `

    // Update thread
    if (originalMessage.thread_id) {
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
        WHERE id = ${originalMessage.thread_id}
      `
    }

    // Store in email_messages table
    await sql`
      INSERT INTO email_messages (
        account_id,
        contact_id,
        thread_id,
        outlook_message_id,
        direction,
        subject,
        body,
        received_at,
        is_read
      ) VALUES (
        ${accountId},
        ${originalMessage.contact_id},
        ${originalMessage.thread_id || email.conversationId},
        ${email.internetMessageId || email.id},
        'received',
        ${email.subject},
        ${email.body.content},
        ${messageTime.toISOString()},
        false
      )
      ON CONFLICT (outlook_message_id) DO NOTHING
    `

    // Update contact status
    await sql`
      UPDATE contacts
      SET 
        status = 'replied',
        reply_received_at = ${messageTime.toISOString()}
      WHERE id = ${originalMessage.contact_id}
    `

    console.log(`[v0] [OUTLOOK-SYNC] Stored reply from ${email.from.emailAddress.address}`)
    return true
  } catch (error) {
    console.error("[v0] [OUTLOOK-SYNC] Error detecting/storing reply:", error)
    return false
  }
}
