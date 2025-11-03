import { getValidAccessToken, getZohoUrls } from "./zoho-oauth"

export interface ZohoMessage {
  messageId: string
  fromAddress: string
  toAddress: string
  ccAddress?: string
  subject: string
  content: string
  summary: string
  time: number
  sentDateInGMT?: string // Unix timestamp in milliseconds as string
  hasAttachment: boolean
  isRead: boolean
  threadId?: string
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
export async function getInboxFolderId(userAccountId?: string): Promise<string> {
  const { token, config } = await getValidAccessToken(userAccountId)
  const urls = getZohoUrls(config.data_center)

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/folders`

  console.log("[v0] Fetching folders from:", url)

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] Failed to fetch folders:", error)
    // Fallback to default inbox folder ID
    return "1"
  }

  const data = await response.json()
  console.log("[v0] Folders response:", JSON.stringify(data).substring(0, 500))

  let folders: ZohoFolder[] = []

  // Handle different response formats
  if (data.status?.code === 200 && data.data) {
    folders = Array.isArray(data.data) ? data.data : []
  } else if (Array.isArray(data)) {
    folders = data
  } else if (data.data && Array.isArray(data.data)) {
    folders = data.data
  }

  console.log("[v0] Found folders:", folders.map((f) => `${f.folderName} (${f.folderId})`).join(", "))

  // Find inbox folder (case-insensitive)
  const inboxFolder = folders.find((f) => f.folderName.toLowerCase() === "inbox" || f.path?.toLowerCase() === "/inbox")

  if (inboxFolder) {
    console.log("[v0] Found inbox folder:", inboxFolder.folderId, inboxFolder.folderName)
    return inboxFolder.folderId
  }

  // Fallback: return first folder or default "1"
  console.warn("[v0] Inbox folder not found, using fallback")
  return folders.length > 0 ? folders[0].folderId : "1"
}

// Fetch messages from inbox
export async function fetchInboxMessages(params?: {
  limit?: number
  start?: number
  searchKey?: string
  userAccountId?: string
}): Promise<ZohoMessage[]> {
  const { token, config } = await getValidAccessToken(params?.userAccountId)
  const urls = getZohoUrls(config.data_center)

  const queryParams = new URLSearchParams({
    limit: String(params?.limit || 50),
    start: String(params?.start || 0),
  })

  if (params?.searchKey) {
    queryParams.append("searchKey", params.searchKey)
  }

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages/view?${queryParams}`

  console.log("[v0] Fetching inbox messages from:", url)

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] Zoho Mail API error:", error)
    throw new Error(`Failed to fetch inbox messages: ${response.status} ${error}`)
  }

  const data = await response.json()
  console.log("[v0] Zoho Mail API response structure:", JSON.stringify(data).substring(0, 200))

  // Handle different response formats
  if (Array.isArray(data)) {
    return data
  }
  if (data.data && Array.isArray(data.data)) {
    return data.data
  }
  if (data[1] && Array.isArray(data[1])) {
    return data[1]
  }

  console.warn("[v0] Unexpected response format:", data)
  return []
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
  if (Array.isArray(data)) {
    return data
  }
  if (data.data && Array.isArray(data.data)) {
    return data.data
  }
  if (data[1] && Array.isArray(data[1])) {
    return data[1]
  }

  return []
}

// Search for recent messages
export async function searchRecentMessages(daysBack = 30, settingsOrAccountId?: any): Promise<ZohoMessage[]> {
  let token: string
  let config: any

  // Check if we received settings directly or need to fetch them
  if (settingsOrAccountId && typeof settingsOrAccountId === "object" && settingsOrAccountId.access_token) {
    // We received settings directly
    config = settingsOrAccountId
    token = config.access_token
    console.log("[v0] Using provided Zoho settings directly")
  } else {
    // We received an account ID, fetch the settings
    const result = await getValidAccessToken(settingsOrAccountId)
    token = result.token
    config = result.config
    console.log("[v0] Fetched Zoho settings using account ID")
  }

  const urls = getZohoUrls(config.data_center)

  // Calculate date for search (YYYY/MM/DD format)
  const date = new Date()
  date.setDate(date.getDate() - daysBack)
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`

  // Search for messages received after the date (searches all folders by default)
  const searchKey = `after:${dateStr}`

  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages/search?searchKey=${encodeURIComponent(searchKey)}&limit=200`

  console.log("[v0] Searching for recent messages with query:", searchKey)
  console.log("[v0] Search URL:", url)
  console.log("[v0] Using Zoho account ID:", config.zoho_account_id)

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
  console.log("[v0] Search response structure:", JSON.stringify(data).substring(0, 500))

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

  const normalizedMessages: ZohoMessage[] = messages.map((msg) => {
    // Extract sender email from various possible field formats
    let fromAddress = msg.fromAddress || msg.from || msg.sender || ""

    // If it's an object with address property, extract it
    if (typeof fromAddress === "object" && fromAddress.address) {
      fromAddress = fromAddress.address
    }

    // Extract recipient email
    let toAddress = msg.toAddress || msg.to || ""
    if (typeof toAddress === "object" && toAddress.address) {
      toAddress = toAddress.address
    }

    // Log first message structure for debugging
    if (messages.indexOf(msg) === 0) {
      console.log("[v0] First message structure sample:", JSON.stringify(msg).substring(0, 300))
      console.log("[v0] Extracted fromAddress:", fromAddress)
      console.log("[v0] Extracted toAddress:", toAddress)
    }

    return {
      messageId: msg.messageId || msg.id || "",
      fromAddress,
      toAddress,
      ccAddress: msg.ccAddress || msg.cc || "",
      subject: msg.subject || "",
      content: msg.content || msg.body || "",
      summary: msg.summary || "",
      time: msg.sentDateInGMT ? Number(msg.sentDateInGMT) : msg.time || Date.now(),
      sentDateInGMT: msg.sentDateInGMT,
      hasAttachment: msg.hasAttachment || false,
      isRead: msg.isRead || false,
      threadId: msg.threadId || msg.conversationId || "",
    }
  })

  console.log(`[v0] Found ${normalizedMessages.length} messages from last ${daysBack} days`)
  return normalizedMessages
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
