import { sql } from "@/lib/db"
import { getValidAccessToken } from "@/lib/zoho-oauth"
import { getLastChecked, setLastChecked } from "@/lib/redis"

interface ZohoMessage {
  messageId: string
  fromAddress: string
  toAddress: string
  ccAddress?: string
  subject: string
  receivedTime: number
  content?: string
  summary?: string
  hasAttachment: boolean
  threadId?: string
  inReplyTo?: string
  references?: string
}

interface EmailAccount {
  account_id: string
  access_token: string
  refresh_token: string
  datacenter: string
}

export async function syncEmailsForAccount(account: EmailAccount): Promise<number> {
  try {
    console.log(`[v0] Syncing emails for account: ${account.account_id}`)

    // Get last checked timestamp from Redis
    const lastChecked = await getLastChecked(account.account_id)
    const lastCheckedDate = new Date(lastChecked)

    console.log(`[v0] Last checked: ${lastCheckedDate.toISOString()}`)

    // Get valid access token (handles refresh if needed)
    const accessToken = await getValidAccessToken(account.account_id)

    // Fetch new emails from Zoho Mail API
    const newEmails = await fetchNewEmails(accessToken, account.datacenter, lastCheckedDate)

    console.log(`[v0] Found ${newEmails.length} new emails`)

    // Process each email and detect replies
    let repliesDetected = 0
    for (const email of newEmails) {
      const isReply = await detectAndStoreReply(email, account.account_id)
      if (isReply) repliesDetected++
    }

    // Update last checked timestamp
    await setLastChecked(account.account_id, Date.now())

    console.log(`[v0] Detected ${repliesDetected} replies`)
    return repliesDetected
  } catch (error) {
    console.error(`[v0] Error syncing emails for account ${account.account_id}:`, error)
    throw error
  }
}

async function fetchNewEmails(accessToken: string, datacenter: string, since: Date): Promise<ZohoMessage[]> {
  try {
    // Format date for Zoho API (milliseconds since epoch)
    const sinceTimestamp = since.getTime()

    // Fetch messages from Zoho Mail API
    const response = await fetch(
      `https://mail.zoho.${datacenter}/api/accounts/primary/messages/search?searchKey=receivedTime:${sinceTimestamp}&limit=100`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Zoho API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("[v0] Error fetching emails from Zoho:", error)
    return []
  }
}

async function detectAndStoreReply(email: ZohoMessage, accountId: string): Promise<boolean> {
  try {
    // Check if this email is a reply by looking at In-Reply-To or References headers
    const inReplyTo = email.inReplyTo
    const emailReferences = email.references

    if (!inReplyTo && !emailReferences) {
      // Not a reply
      return false
    }

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
        AND em.direction = 'outbound'
        AND (
          em.zoho_message_id = ${inReplyTo}
          OR em.zoho_message_id = ANY(string_to_array(${emailReferences || ""}, ' '))
        )
      LIMIT 1
    `

    if (sentMessage.length === 0) {
      // Not a reply to our message
      return false
    }

    const originalMessage = sentMessage[0]

    // Check if reply already exists
    const existingReply = await sql`
      SELECT id FROM replies
      WHERE account_id = ${accountId}
        AND zoho_message_id = ${email.messageId}
      LIMIT 1
    `

    if (existingReply.length > 0) {
      // Reply already stored
      return false
    }

    // Store the reply
    await sql`
      INSERT INTO replies (
        account_id,
        contact_id,
        thread_id,
        message_id,
        zoho_message_id,
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
        ${originalMessage.thread_id || email.threadId},
        ${email.messageId},
        ${email.messageId},
        ${inReplyTo},
        ${emailReferences},
        ${email.subject},
        ${email.fromAddress},
        ${email.fromAddress.split("@")[0]},
        ${new Date(email.receivedTime)},
        ${email.summary || email.content || ""},
        ${email.content || ""},
        false
      )
    `

    if (originalMessage.thread_id) {
      await sql`
        UPDATE email_threads
        SET 
          has_unread_replies = true,
          reply_count = reply_count + 1,
          message_count = message_count + 1,
          last_message_at = ${new Date(email.receivedTime)},
          last_reply_at = ${new Date(email.receivedTime)},
          status = 'replied',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${originalMessage.thread_id}
      `
    }

    // Also store in email_messages table for thread continuity
    await sql`
      INSERT INTO email_messages (
        account_id,
        contact_id,
        thread_id,
        zoho_message_id,
        direction,
        subject,
        body,
        sent_at,
        is_read
      ) VALUES (
        ${accountId},
        ${originalMessage.contact_id},
        ${originalMessage.thread_id || email.threadId},
        ${email.messageId},
        'received',
        ${email.subject},
        ${email.summary || email.content || ""},
        ${new Date(email.receivedTime)},
        false
      )
      ON CONFLICT (zoho_message_id) DO NOTHING
    `

    await sql`
      UPDATE contacts
      SET 
        status = 'replied',
        reply_received_at = ${new Date(email.receivedTime)}
      WHERE id = ${originalMessage.contact_id}
    `

    console.log(`[v0] Stored reply from ${email.fromAddress} for thread ${originalMessage.thread_id}`)
    return true
  } catch (error) {
    console.error("[v0] Error detecting/storing reply:", error)
    return false
  }
}
