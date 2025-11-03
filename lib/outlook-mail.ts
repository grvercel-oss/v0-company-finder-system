import { getOutlookConfig, refreshOutlookToken } from "./outlook-oauth"

export interface OutlookMessage {
  id: string
  subject: string
  from: {
    emailAddress: {
      address: string
      name: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      address: string
      name: string
    }
  }>
  body: {
    contentType: string
    content: string
  }
  receivedDateTime: string
  conversationId: string
  internetMessageId?: string
  internetMessageHeaders?: Array<{
    name: string
    value: string
  }>
}

async function getValidToken(accountId: string, forceRefresh = false): Promise<string> {
  console.log("[v0] [OUTLOOK-MAIL] Getting valid token for account:", accountId)

  const config = await getOutlookConfig(accountId)

  if (!config) {
    throw new Error("Outlook not configured")
  }

  if (forceRefresh) {
    console.log("[v0] [OUTLOOK-MAIL] Force refreshing token due to 401 error...")
    const newAccessToken = await refreshOutlookToken(config.refresh_token, accountId)
    console.log("[v0] [OUTLOOK-MAIL] Token refreshed, new token (first 50 chars):", newAccessToken?.substring(0, 50))
    return newAccessToken
  }

  console.log("[v0] [OUTLOOK-MAIL] Got config, access_token (first 50 chars):", config.access_token?.substring(0, 50))
  console.log("[v0] [OUTLOOK-MAIL] Token expires at:", config.expires_at)

  return config.access_token
}

export async function sendOutlookEmail(params: {
  accountId: string
  to: string
  subject: string
  body: string
  isHtml?: boolean
}): Promise<{ messageId: string; conversationId: string; internetMessageId: string }> {
  const { accountId, to, subject, body, isHtml = true } = params

  console.log("[v0] [OUTLOOK-MAIL] ========== SENDING EMAIL ==========")
  console.log("[v0] [OUTLOOK-MAIL] To:", to)
  console.log("[v0] [OUTLOOK-MAIL] Subject:", subject)
  console.log("[v0] [OUTLOOK-MAIL] Body length:", body?.length)
  console.log("[v0] [OUTLOOK-MAIL] Is HTML:", isHtml)

  let accessToken = await getValidToken(accountId, false)
  let attempt = 1
  const maxAttempts = 2

  while (attempt <= maxAttempts) {
    console.log(`[v0] [OUTLOOK-MAIL] Attempt ${attempt}/${maxAttempts}`)

    const message = {
      subject,
      body: {
        contentType: isHtml ? "HTML" : "Text",
        content: body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    }

    console.log("[v0] [OUTLOOK-MAIL] Step 1: Creating message draft...")

    try {
      const createResponse = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      })

      console.log("[v0] [OUTLOOK-MAIL] Create response status:", createResponse.status)

      if (createResponse.status === 401 && attempt === 1) {
        console.log("[v0] [OUTLOOK-MAIL] ⚠️ Got 401 Unauthorized - refreshing token...")
        accessToken = await getValidToken(accountId, true)
        attempt++
        continue
      }

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error("[v0] [OUTLOOK-MAIL] ❌ Failed to create message:", errorText)
        throw new Error(`Failed to create message (${createResponse.status}): ${errorText}`)
      }

      const createdMessage = await createResponse.json()
      const messageId = createdMessage.id
      const internetMessageId = createdMessage.internetMessageId
      const conversationId = createdMessage.conversationId

      console.log("[v0] [OUTLOOK-MAIL] ✅ Message created successfully")
      console.log("[v0] [OUTLOOK-MAIL] Message ID:", messageId)
      console.log("[v0] [OUTLOOK-MAIL] Internet Message ID:", internetMessageId)
      console.log("[v0] [OUTLOOK-MAIL] Conversation ID:", conversationId)

      console.log("[v0] [OUTLOOK-MAIL] Step 2: Sending message...")

      const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      console.log("[v0] [OUTLOOK-MAIL] Send response status:", sendResponse.status)

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text()
        console.error("[v0] [OUTLOOK-MAIL] ❌ Failed to send message:", errorText)
        throw new Error(`Failed to send message (${sendResponse.status}): ${errorText}`)
      }

      console.log("[v0] [OUTLOOK-MAIL] ✅ Email sent successfully!")
      console.log("[v0] [OUTLOOK-MAIL] ========== EMAIL SEND COMPLETE ==========")

      return {
        messageId,
        conversationId,
        internetMessageId,
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error("[v0] [OUTLOOK-MAIL] ❌ All attempts failed:", error)
        throw error
      }

      console.error("[v0] [OUTLOOK-MAIL] ❌ Attempt failed:", error)
      attempt++
    }
  }

  throw new Error("Failed to send email after all attempts")
}

export async function getOutlookMessages(accountId: string, since?: Date, limit = 100): Promise<OutlookMessage[]> {
  const accessToken = await getValidToken(accountId)

  let url = `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$orderby=receivedDateTime desc`

  if (since) {
    const isoDate = since.toISOString()
    url += `&$filter=receivedDateTime ge ${isoDate}`
  }

  url += "&$expand=singleValueExtendedProperties($filter=id eq 'String 0x007D')"
  url +=
    "&$select=id,subject,from,toRecipients,body,receivedDateTime,conversationId,internetMessageId,internetMessageHeaders"

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("Failed to fetch Outlook messages:", error)
    throw new Error(`Failed to fetch messages: ${error}`)
  }

  const data = await response.json()
  return data.value || []
}

export async function getOutlookMessageById(accountId: string, messageId: string): Promise<OutlookMessage> {
  const accessToken = await getValidToken(accountId)

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$expand=internetMessageHeaders`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch message: ${error}`)
  }

  return response.json()
}

export async function sendOutlookReply(params: {
  accountId: string
  messageId: string
  to: string
  subject: string
  body: string
  isHtml?: boolean
}): Promise<{ messageId: string; conversationId: string }> {
  const { accountId, messageId, to, subject, body, isHtml = true } = params

  const accessToken = await getValidToken(accountId)

  const replyMessage = {
    message: {
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
      body: {
        contentType: isHtml ? "HTML" : "Text",
        content: body,
      },
    },
    comment: body,
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(replyMessage),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("Failed to send Outlook reply:", error)
    throw new Error(`Failed to send reply: ${error}`)
  }

  const sentMessages = await getOutlookMessages(accountId, new Date(Date.now() - 60000), 1)
  const sentMessage = sentMessages.find(
    (m) => m.subject.includes(subject) && m.toRecipients.some((r) => r.emailAddress.address === to),
  )

  return {
    messageId: sentMessage?.internetMessageId || `outlook-reply-${Date.now()}`,
    conversationId: sentMessage?.conversationId || `conv-${Date.now()}`,
  }
}

export function isOutlookReply(message: OutlookMessage): { isReply: boolean; inReplyTo?: string; references?: string } {
  if (!message.internetMessageHeaders) {
    return { isReply: false }
  }

  const inReplyToHeader = message.internetMessageHeaders.find((h) => h.name.toLowerCase() === "in-reply-to")
  const referencesHeader = message.internetMessageHeaders.find((h) => h.name.toLowerCase() === "references")

  const isReply = !!(inReplyToHeader || referencesHeader)

  return {
    isReply,
    inReplyTo: inReplyToHeader?.value,
    references: referencesHeader?.value,
  }
}

export async function markOutlookAsRead(accountId: string, messageId: string): Promise<void> {
  const accessToken = await getValidToken(accountId)

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to mark message as read: ${error}`)
  }
}
