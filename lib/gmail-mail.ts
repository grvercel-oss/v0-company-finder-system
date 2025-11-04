import { getGmailConfig, refreshGmailToken } from "./gmail-oauth"

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{
      name: string
      value: string
    }>
    body: {
      data?: string
      size: number
    }
    parts?: Array<{
      mimeType: string
      body: {
        data?: string
        size: number
      }
    }>
  }
  internalDate: string
}

async function getValidToken(accountId: string, forceRefresh = false): Promise<string> {
  console.log("[v0] [GMAIL] Getting valid token for account:", accountId)

  const config = await getGmailConfig(accountId)

  if (!config) {
    throw new Error("Gmail not configured")
  }

  if (forceRefresh) {
    console.log("[v0] [GMAIL] Force refreshing token due to 401 error...")
    const newAccessToken = await refreshGmailToken(config.refresh_token, accountId)
    console.log("[v0] [GMAIL] Token refreshed, new token (first 50 chars):", newAccessToken?.substring(0, 50))
    return newAccessToken
  }

  console.log("[v0] [GMAIL] Got config, access_token (first 50 chars):", config.access_token?.substring(0, 50))
  console.log("[v0] [GMAIL] Token expires at:", new Date(config.expires_at).toISOString())

  return config.access_token
}

// Create RFC 2822 formatted email and encode to base64url
function createRFC2822Email(params: {
  from: string
  to: string
  subject: string
  body: string
  isHtml?: boolean
}): string {
  const { from, to, subject, body, isHtml = true } = params

  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
  ]

  const email = messageParts.join("\r\n")

  // Convert to base64url (Gmail's required format)
  const base64 = Buffer.from(email).toString("base64")
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

  return base64url
}

// Send email via Gmail API
export async function sendGmailEmail(params: {
  accountId: string
  to: string
  subject: string
  body: string
  isHtml?: boolean
}): Promise<{ messageId: string; threadId: string; labelIds: string[] }> {
  const { accountId, to, subject, body, isHtml = true } = params

  console.log("[v0] [GMAIL] ========== SENDING EMAIL ==========")
  console.log("[v0] [GMAIL] To:", to)
  console.log("[v0] [GMAIL] Subject:", subject)
  console.log("[v0] [GMAIL] Body length:", body?.length)
  console.log("[v0] [GMAIL] Is HTML:", isHtml)

  // Get user's email address from config
  const config = await getGmailConfig(accountId)
  if (!config) {
    throw new Error("Gmail not configured")
  }

  let accessToken = await getValidToken(accountId, false)
  let attempt = 1
  const maxAttempts = 2

  while (attempt <= maxAttempts) {
    console.log(`[v0] [GMAIL] Attempt ${attempt}/${maxAttempts}`)

    try {
      // Create RFC 2822 formatted email
      const raw = createRFC2822Email({
        from: config.email,
        to,
        subject,
        body,
        isHtml,
      })

      console.log("[v0] [GMAIL] Sending message via Gmail API...")

      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      })

      console.log("[v0] [GMAIL] Send response status:", response.status)

      if (response.status === 401 && attempt === 1) {
        console.log("[v0] [GMAIL] ⚠️ Got 401 Unauthorized - refreshing token...")
        accessToken = await getValidToken(accountId, true)
        attempt++
        continue
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] [GMAIL] ❌ Failed to send message:", errorText)
        throw new Error(`Failed to send message (${response.status}): ${errorText}`)
      }

      const result = await response.json()

      console.log("[v0] [GMAIL] ✅ Email sent successfully!")
      console.log("[v0] [GMAIL] Message ID:", result.id)
      console.log("[v0] [GMAIL] Thread ID:", result.threadId)
      console.log("[v0] [GMAIL] Label IDs:", result.labelIds)
      console.log("[v0] [GMAIL] ========== EMAIL SEND COMPLETE ==========")

      return {
        messageId: result.id,
        threadId: result.threadId,
        labelIds: result.labelIds || [],
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error("[v0] [GMAIL] ❌ All attempts failed:", error)
        throw error
      }

      console.error("[v0] [GMAIL] ❌ Attempt failed:", error)
      attempt++
    }
  }

  throw new Error("Failed to send email after all attempts")
}

// Get Gmail messages with filters
export async function getGmailMessages(
  accountId: string,
  params?: {
    maxResults?: number
    labelIds?: string[]
    q?: string // Search query
  },
): Promise<GmailMessage[]> {
  const accessToken = await getValidToken(accountId)

  const queryParams = new URLSearchParams({
    maxResults: String(params?.maxResults || 100),
  })

  if (params?.labelIds && params.labelIds.length > 0) {
    params.labelIds.forEach((labelId) => queryParams.append("labelIds", labelId))
  }

  if (params?.q) {
    queryParams.append("q", params.q)
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${queryParams}`

  console.log("[v0] [GMAIL] Fetching messages from:", url)

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] [GMAIL] Failed to fetch messages:", error)
    throw new Error(`Failed to fetch messages: ${response.status} ${error}`)
  }

  const data = await response.json()
  const messageIds = data.messages || []

  console.log(`[v0] [GMAIL] Found ${messageIds.length} messages`)

  // Fetch full details for each message
  const messages: GmailMessage[] = []
  for (const { id } of messageIds) {
    try {
      const message = await getGmailMessageById(accountId, id)
      messages.push(message)
    } catch (error) {
      console.error(`[v0] [GMAIL] Failed to fetch message ${id}:`, error)
    }
  }

  return messages
}

// Get specific message by ID
export async function getGmailMessageById(accountId: string, messageId: string): Promise<GmailMessage> {
  const accessToken = await getValidToken(accountId)

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch message: ${response.status} ${error}`)
  }

  return response.json()
}

// Check if message is a reply
export function isGmailReply(message: GmailMessage): {
  isReply: boolean
  inReplyTo?: string
  references?: string
} {
  const headers = message.payload.headers

  const inReplyToHeader = headers.find((h) => h.name.toLowerCase() === "in-reply-to")
  const referencesHeader = headers.find((h) => h.name.toLowerCase() === "references")

  const isReply = !!(inReplyToHeader || referencesHeader)

  return {
    isReply,
    inReplyTo: inReplyToHeader?.value,
    references: referencesHeader?.value,
  }
}

// Extract email address from header value
export function extractEmailFromHeader(headerValue: string): string {
  // Handle formats like "Name <email@example.com>" or just "email@example.com"
  const match = headerValue.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase().trim() : headerValue.toLowerCase().trim()
}

// Get sender email from message
export function getGmailSender(message: GmailMessage): string {
  const fromHeader = message.payload.headers.find((h) => h.name.toLowerCase() === "from")
  return fromHeader ? extractEmailFromHeader(fromHeader.value) : ""
}

// Get recipient email from message
export function getGmailRecipient(message: GmailMessage): string {
  const toHeader = message.payload.headers.find((h) => h.name.toLowerCase() === "to")
  return toHeader ? extractEmailFromHeader(toHeader.value) : ""
}

// Get subject from message
export function getGmailSubject(message: GmailMessage): string {
  const subjectHeader = message.payload.headers.find((h) => h.name.toLowerCase() === "subject")
  return subjectHeader?.value || ""
}

// Mark message as read
export async function markGmailAsRead(accountId: string, messageId: string): Promise<void> {
  const accessToken = await getValidToken(accountId)

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      removeLabelIds: ["UNREAD"],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to mark message as read: ${response.status} ${error}`)
  }
}
