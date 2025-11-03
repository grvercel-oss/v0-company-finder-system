import { sql } from "@/lib/db"
import { getEmailProvider, saveEmailProvider, type ZohoSettings } from "@/lib/email-provider"

export interface ZohoConfig {
  id: number
  refresh_token: string
  access_token?: string
  token_expires_at?: Date
  account_id: string
  zoho_account_id: string // Added Zoho account ID field
  account_email: string
  account_name?: string
  data_center: string
  is_active: boolean
  user_account_id?: string
  provider?: string
  created_at: Date
  updated_at: Date
}

const DATA_CENTERS = {
  com: { accounts: "https://accounts.zoho.com", mail: "https://mail.zoho.com" },
  eu: { accounts: "https://accounts.zoho.eu", mail: "https://mail.zoho.eu" },
  in: { accounts: "https://accounts.zoho.in", mail: "https://mail.zoho.in" },
  au: { accounts: "https://accounts.zoho.com.au", mail: "https://mail.zoho.com.au" },
  jp: { accounts: "https://accounts.zoho.jp", mail: "https://mail.zoho.jp" },
  ca: { accounts: "https://accounts.zoho.ca", mail: "https://mail.zoho.ca" },
}

export function getZohoUrls(dataCenter: string) {
  return DATA_CENTERS[dataCenter as keyof typeof DATA_CENTERS] || DATA_CENTERS.com
}

export function getPlatformCredentials() {
  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const dataCenter = process.env.ZOHO_DATACENTER || "com"

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Zoho platform credentials. Please set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET environment variables.",
    )
  }

  return { clientId, clientSecret, dataCenter }
}

export async function getZohoConfig(userAccountId?: string): Promise<ZohoConfig | null> {
  if (!userAccountId) {
    // Fallback: get any zoho provider
    const result = await sql`
      SELECT account_id, settings, connected_at, updated_at
      FROM account_email_provider
      WHERE provider = 'zoho'
      LIMIT 1
    `

    if (result.length === 0) return null

    const config = result[0]
    const settings = config.settings as ZohoSettings

    return {
      id: 0,
      account_id: config.account_id,
      user_account_id: config.account_id,
      zoho_account_id: settings.zoho_account_id, // Use Zoho account ID from settings
      refresh_token: settings.refresh_token,
      access_token: settings.access_token,
      token_expires_at: settings.token_expires_at,
      account_email: settings.email,
      account_name: settings.account_name,
      data_center: settings.data_center,
      is_active: settings.is_active ?? true,
      provider: "zoho",
      created_at: config.connected_at,
      updated_at: config.updated_at,
    } as ZohoConfig
  }

  const providerConfig = await getEmailProvider(userAccountId)

  if (!providerConfig || providerConfig.provider !== "zoho") {
    return null
  }

  const settings = providerConfig.settings as ZohoSettings

  return {
    id: 0,
    account_id: userAccountId,
    user_account_id: userAccountId,
    zoho_account_id: settings.zoho_account_id, // Use Zoho account ID from settings
    refresh_token: settings.refresh_token,
    access_token: settings.access_token,
    token_expires_at: settings.token_expires_at,
    account_email: settings.email,
    account_name: settings.account_name,
    data_center: settings.data_center,
    is_active: settings.is_active ?? true,
    provider: "zoho",
    created_at: providerConfig.connected_at,
    updated_at: providerConfig.updated_at,
  } as ZohoConfig
}

export async function refreshAccessToken(config: ZohoConfig): Promise<string> {
  const { clientId, clientSecret } = getPlatformCredentials()
  const urls = getZohoUrls(config.data_center)

  const response = await fetch(`${urls.accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: config.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to refresh access token: ${errorText}`)
  }

  const data = await response.json()

  if (!data.access_token) {
    throw new Error("No access token in response")
  }

  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000)
  const accountId = config.user_account_id || config.account_id

  const providerConfig = await getEmailProvider(accountId)
  if (providerConfig && providerConfig.provider === "zoho") {
    const settings = providerConfig.settings as ZohoSettings
    await saveEmailProvider(accountId, "zoho", {
      ...settings,
      access_token: data.access_token,
      token_expires_at: expiresAt,
    })
  }

  return data.access_token
}

export async function getValidAccessToken(userAccountId?: string): Promise<{ token: string; config: ZohoConfig }> {
  const config = await getZohoConfig(userAccountId)

  if (!config) {
    throw new Error("No Zoho configuration found. Please connect your Zoho account.")
  }

  // Check if token is still valid (with 5 minute buffer)
  const now = new Date()
  const expiresAt = config.token_expires_at ? new Date(config.token_expires_at) : new Date(0)
  const bufferTime = 5 * 60 * 1000 // 5 minutes

  if (config.access_token && expiresAt.getTime() > now.getTime() + bufferTime) {
    return { token: config.access_token, config }
  }

  // Token expired or missing, refresh it
  const newToken = await refreshAccessToken(config)
  return { token: newToken, config }
}

export async function sendEmail(params: {
  to: string
  subject: string
  body: string
  fromAddress?: string
}) {
  const { token, config } = await getValidAccessToken()

  console.log(
    "[v0] [ZOHO-SEND] Full config:",
    JSON.stringify(
      {
        account_id: config.account_id,
        zoho_account_id: config.zoho_account_id,
        account_email: config.account_email,
        data_center: config.data_center,
      },
      null,
      2,
    ),
  )

  if (!config.zoho_account_id) {
    throw new Error("Zoho account ID is missing. Please reconnect your Zoho account in Settings.")
  }

  const urls = getZohoUrls(config.data_center)
  const url = `${urls.mail}/api/accounts/${config.zoho_account_id}/messages`

  console.log("[v0] [ZOHO-SEND] Sending email via Zoho API:", url)
  console.log("[v0] [ZOHO-SEND] Zoho account ID:", config.zoho_account_id)
  console.log(
    "[v0] [ZOHO-SEND] Request body:",
    JSON.stringify(
      {
        fromAddress: params.fromAddress || config.account_email,
        toAddress: params.to,
        subject: params.subject,
        mailFormat: "html",
      },
      null,
      2,
    ),
  )

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromAddress: params.fromAddress || config.account_email,
      toAddress: params.to,
      subject: params.subject,
      content: params.body,
      mailFormat: "html",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] [ZOHO-SEND] Failed to send email:", error)
    console.error("[v0] [ZOHO-SEND] Response status:", response.status)
    console.error("[v0] [ZOHO-SEND] Response headers:", JSON.stringify(Object.fromEntries(response.headers.entries())))
    throw new Error(`Failed to send email: ${error}`)
  }

  const result = await response.json()
  console.log("[v0] [ZOHO-SEND] Email sent successfully:", result)
  return result
}
