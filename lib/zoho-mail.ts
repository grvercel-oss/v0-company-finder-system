import { getValidAccessToken, getZohoUrls } from "./zoho-oauth"

export interface ZohoMessage {
  messageId: string
  fromAddress: string
  toAddress?: string
  ccAddress?: string
  subject: string
  content?: string
  summary: string
  time: number
  sentDateInGMT?: string | number
  receivedTime?: number
  hasAttachment: boolean
  isRead?: boolean
  status?: string
  threadId?: string
  folderId?: string
  sender?: string // Display name of sender
}

export interface ZohoThread {
  threadId: string
  subject: string
  messageCount: number
  hasAttachment: boolean
  time: number
  fromAddress: string
}

export interface ZohoFolder {
  folderId: string
  folderName: string
  path: string
  parentFolderId?: string
  messageCount?: number
}

// Fetch inbox folder ID
export async function getInboxFolderId(settingsOrAccountId?: any): Promise<string> {
  let token: string
  let config: any

  if (settingsOrAccountId && typeof settingsOrAccountId === "object" && settingsOrAccountId.access_token) {
    config = settingsOrAccountId
    token = config.access_token
  } else {
    const result = await getValidAccessToken(settingsOrAccountId)
    token = result.token
    config = result.config
  }

  const urls = getZohoUrls(config.data_center)
  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/folders`

  console.log("[v0] [ZOHO] Fetching folders from:", url)

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] [ZOHO] Failed to fetch folders:", error)
    throw new Error(`Failed to fetch folders: ${response.status}`)
  }

  const data = await response.json()

  let folders: any[] = []
  if (data.status?.code === 200 && data.data) {
    folders = Array.isArray(data.data) ? data.data : []
  }

  console.log("[v0] [ZOHO] Available folders:", folders.map((f) => `${f.folderName} (${f.folderId})`).join(", "))

  // Find inbox folder (case-insensitive)
  const inboxFolder = folders.find((f) => f.folderName?.toLowerCase() === "inbox")

  if (!inboxFolder) {
    throw new Error("Inbox folder not found")
  }

  console.log("[v0] [ZOHO] Using inbox folder ID:", inboxFolder.folderId)
  return String(inboxFolder.folderId)
}

// Fetch messages from inbox
export async function fetchInboxMessages(
  settingsOrAccountId?: any,
  params?: {
    limit?: number
    start?: number
    daysBack?: number
  },
): Promise<ZohoMessage[]> {
  let token: string
  let config: any

  if (settingsOrAccountId && typeof settingsOrAccountId === "object" && settingsOrAccountId.access_token) {
    config = settingsOrAccountId
    token = config.access_token
  } else {
    const result = await getValidAccessToken(settingsOrAccountId)
    token = result.token
    config = result.config
  }

  const urls = getZohoUrls(config.data_center)

  // Get inbox folder ID
  const inboxFolderId = await getInboxFolderId(config)

  // Build query parameters
  const queryParams = new URLSearchParams({
    folderId: inboxFolderId,
    limit: String(params?.limit || 200),
    start: String(params?.start || 1), // Zoho uses 1-based indexing
    sortBy: "date",
    sortorder: "false", // false = descending (newest first)
    includesent: "false", // CRITICAL: Exclude sent messages
    includeto: "true", // Include recipient details
  })

  // If daysBack is specified, calculate receivedTime filter
  if (params?.daysBack) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - params.daysBack)
    // Zoho expects Unix timestamp in milliseconds
    queryParams.append("receivedTime", String(cutoffDate.getTime()))
  }

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages/view?${queryParams}`

  console.log("[v0] [ZOHO] Fetching inbox messages from:", url)

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] [ZOHO] API error:", error)
    throw new Error(`Failed to fetch inbox messages: ${response.status} ${error}`)
  }

  const data = await response.json()

  let messages: any[] = []
  if (data.status?.code === 200 && data.data) {
    messages = Array.isArray(data.data) ? data.data : []
  }

  console.log(`[v0] [ZOHO] Fetched ${messages.length} inbox messages`)

  const normalizedMessages: ZohoMessage[] = messages.map((msg) => {
    // Extract sender email - Zoho returns it as a plain string in fromAddress
    const fromAddress = (msg.fromAddress || "").toLowerCase().trim()

    // Extract recipient - may need to parse if it includes display name
    let toAddress = msg.toAddress || ""
    if (typeof toAddress === "string") {
      // Remove angle brackets if present: "Name <email@example.com>" -> "email@example.com"
      const emailMatch = toAddress.match(/<([^>]+)>/)
      toAddress = emailMatch ? emailMatch[1] : toAddress
    }
    toAddress = toAddress.toLowerCase().trim()

    let timestamp = Date.now()
    if (msg.receivedTime) {
      const parsed = typeof msg.receivedTime === "string" ? Number.parseInt(msg.receivedTime, 10) : msg.receivedTime
      if (!isNaN(parsed) && parsed > 0) {
        timestamp = parsed
      }
    } else if (msg.sentDateInGMT) {
      const parsed = typeof msg.sentDateInGMT === "string" ? Number.parseInt(msg.sentDateInGMT, 10) : msg.sentDateInGMT
      if (!isNaN(parsed) && parsed > 0) {
        timestamp = parsed
      }
    }

    return {
      messageId: String(msg.messageId || ""),
      fromAddress,
      toAddress,
      ccAddress: msg.ccAddress || "",
      subject: msg.subject || "",
      content: msg.content || "",
      summary: msg.summary || "",
      time: timestamp,
      sentDateInGMT: msg.sentDateInGMT,
      receivedTime: msg.receivedTime,
      hasAttachment: Boolean(msg.hasAttachment),
      isRead: msg.status === "read",
      status: msg.status,
      threadId: String(msg.threadId || ""),
      folderId: String(msg.folderId || ""),
      sender: msg.sender || "", // Display name
    }
  })

  return normalizedMessages
}

// Fetch a specific message by ID
export async function fetchMessage(messageId: string, userAccountId?: string): Promise<ZohoMessage> {
  const { token, config } = await getValidAccessToken(userAccountId)
  const urls = getZohoUrls(config.data_center)

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages/${messageId}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch message: ${error}`)
  }

  const data = await response.json()
  return data.data
}

// Fetch thread messages
export async function fetchThreadMessages(threadId: string, userAccountId?: string): Promise<ZohoMessage[]> {
  const { token, config } = await getValidAccessToken(userAccountId)
  const urls = getZohoUrls(config.data_center)

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages/thread/${threadId}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch thread messages: ${error}`)
  }

  const data = await response.json()
  return data.data || []
}

// Fetch folder messages
export async function fetchFolderMessages(
  folderId?: string,
  params?: {
    limit?: number
    start?: number
    userAccountId?: string
  },
): Promise<ZohoMessage[]> {
  const { token, config } = await getValidAccessToken(params?.userAccountId)
  const urls = getZohoUrls(config.data_center)

  const actualFolderId = folderId || (await getInboxFolderId(params?.userAccountId))

  const queryParams = new URLSearchParams({
    folderId: actualFolderId,
    limit: String(params?.limit || 100),
    start: String(params?.start || 1), // Zoho API uses 1-based indexing
    sortBy: "date",
    sortorder: "false", // false = descending (newest first)
  })

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages/view?${queryParams}`

  console.log("[v0] Fetching folder messages from:", url)
  console.log("[v0] Using folder ID:", actualFolderId)

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] Zoho Mail API error:", error)
    throw new Error(`Failed to fetch folder messages: ${response.status} ${error}`)
  }

  const data = await response.json()
  console.log("[v0] Folder messages response structure:", JSON.stringify(data).substring(0, 500))

  if (data.status?.code === 200 && data.data) {
    if (Array.isArray(data.data)) {
      console.log("[v0] Returning", data.data.length, "messages from folder", actualFolderId)
      return data.data
    }
  }

  // Fallback for other formats
  if (Array.isArray(data)) {
    return data
  }
  if (data.data && Array.isArray(data.data)) {
    return data.data
  }

  console.warn("[v0] Unexpected response format:", data)
  return []
}

// Search for messages
export async function searchMessages(query: string, userAccountId?: string): Promise<ZohoMessage[]> {
  const { token, config } = await getValidAccessToken(userAccountId)
  const urls = getZohoUrls(config.data_center)

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages/search?searchKey=${encodeURIComponent(query)}`

  console.log("[v0] Searching messages with query:", query)

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] Zoho Mail search error:", error)
    throw new Error(`Failed to search messages: ${response.status} ${error}`)
  }

  const data = await response.json()
  console.log("[v0] Search response structure:", JSON.stringify(data).substring(0, 200))

  // Handle different response formats
  let messages: any[] = []

  if (data.status?.code === 200 && data.data) {
    messages = Array.isArray(data.data) ? data.data : []
  } else if (Array.isArray(data)) {
    messages = data
  } else if (data.data && Array.isArray(data.data)) {
    messages = data.data
  } else if (data[1] && Array.isArray(data[1])) {
    messages = data[1]
  }

  return messages
}

export async function searchRecentMessages(daysBack = 30, settingsOrAccountId?: any): Promise<ZohoMessage[]> {
  console.warn("[v0] [ZOHO] searchRecentMessages is deprecated, use fetchInboxMessages instead")
  return fetchInboxMessages(settingsOrAccountId, { daysBack, limit: 200 })
}

// Send a reply to a message
export async function sendReply(params: {
  messageId: string
  to: string
  subject: string
  body: string
  threadId?: string
  userAccountId?: string
}): Promise<any> {
  const { token, config } = await getValidAccessToken(params.userAccountId)
  const urls = getZohoUrls(config.data_center)

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages`

  const payload: any = {
    fromAddress: config.account_email,
    toAddress: params.to,
    subject: params.subject,
    content: params.body,
    mailFormat: "html",
  }

  // If replying to a message, include the original message ID
  if (params.messageId) {
    payload.replyTo = params.messageId
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send reply: ${error}`)
  }

  return await response.json()
}

// Mark message as read
export async function markAsRead(messageId: string, userAccountId?: string): Promise<void> {
  const { token, config } = await getValidAccessToken(userAccountId)
  const urls = getZohoUrls(config.data_center)

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages/${messageId}/read`

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to mark message as read: ${error}`)
  }
}
