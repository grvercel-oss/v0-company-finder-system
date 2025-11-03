import { getEmailProvider, saveEmailProvider, deleteEmailProvider, type GmailSettings } from "@/lib/email-provider"

export interface GmailConfig {
  account_id: string
  email: string
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface GmailTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

/**
 * Safely converts a date value to ISO string format.
 * Returns null if the date is invalid, null, undefined, or empty.
 */
function safeDateToISO(dateValue: any): string | null {
  if (!dateValue) return null
  const d = new Date(dateValue)
  return isNaN(d.valueOf()) ? null : d.toISOString()
}

const getClientId = () => {
  const clientId = process.env.GMAIL_CLIENT_ID
  console.log("[v0] [GMAIL-OAUTH] Client ID exists:", !!clientId)
  if (!clientId) {
    throw new Error("GMAIL_CLIENT_ID environment variable is required")
  }
  return clientId
}

const getClientSecret = () => {
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  console.log("[v0] [GMAIL-OAUTH] Client Secret exists:", !!clientSecret)
  if (!clientSecret) {
    throw new Error("GMAIL_CLIENT_SECRET environment variable is required")
  }
  return clientSecret
}

const getRedirectUri = () => {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/oauth/callback`
  console.log("[v0] [GMAIL-OAUTH] Redirect URI:", redirectUri)
  if (!redirectUri || redirectUri.includes("undefined")) {
    throw new Error("NEXT_PUBLIC_APP_URL environment variable is required")
  }
  return redirectUri
}

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
]

export function getGmailAuthUrl(state: string): string {
  console.log("[v0] [GMAIL-OAUTH] Generating auth URL with random state for CSRF protection")

  const clientId = getClientId()
  const redirectUri = getRedirectUri()

  console.log("[v0] [GMAIL-OAUTH] OAuth config validated successfully")
  console.log("[v0] [GMAIL-OAUTH] Client ID:", clientId.substring(0, 8) + "...")
  console.log("[v0] [GMAIL-OAUTH] Redirect URI:", redirectUri)

  const authUrl = "https://accounts.google.com/o/oauth2/v2/auth"

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: REQUIRED_SCOPES.join(" "),
    state: state,
    access_type: "offline",
    prompt: "consent",
  })

  const fullUrl = `${authUrl}?${params.toString()}`
  console.log("[v0] [GMAIL-OAUTH] Generated auth URL:", fullUrl)

  return fullUrl
}

export async function exchangeCodeForTokens(code: string): Promise<GmailTokenResponse> {
  console.log("[v0] [GMAIL-OAUTH] Exchanging authorization code for tokens...")
  console.log("[v0] [GMAIL-OAUTH] Code length:", code.length)

  const clientId = getClientId()
  const clientSecret = getClientSecret()
  const redirectUri = getRedirectUri()

  console.log("[v0] [GMAIL-OAUTH] OAuth config validated for token exchange")

  const tokenUrl = "https://oauth2.googleapis.com/token"
  console.log("[v0] [GMAIL-OAUTH] Token URL:", tokenUrl)

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  })

  console.log("[v0] [GMAIL-OAUTH] Making token exchange request...")

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  console.log("[v0] [GMAIL-OAUTH] Token exchange response status:", response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] [GMAIL-OAUTH] Token exchange failed with status:", response.status)
    console.error("[v0] [GMAIL-OAUTH] Error response:", error)
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  const tokens = await response.json()
  console.log("[v0] [GMAIL-OAUTH] Successfully obtained tokens")
  console.log("[v0] [GMAIL-OAUTH] Token type:", tokens.token_type)
  console.log("[v0] [GMAIL-OAUTH] Expires in:", tokens.expires_in, "seconds")
  console.log("[v0] [GMAIL-OAUTH] Scopes:", tokens.scope)

  return tokens
}

export async function refreshGmailToken(refreshToken: string, accountId: string): Promise<string> {
  console.log("[v0] [GMAIL-OAUTH] Refreshing Gmail token...")
  console.log("[v0] [GMAIL-OAUTH] Refresh token (first 20 chars):", refreshToken.substring(0, 20))

  const clientId = getClientId()
  const clientSecret = getClientSecret()

  console.log("[v0] [GMAIL-OAUTH] OAuth config validated for token refresh")

  const tokenUrl = "https://oauth2.googleapis.com/token"

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })

  console.log("[v0] [GMAIL-OAUTH] Making token refresh request...")

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  console.log("[v0] [GMAIL-OAUTH] Token refresh response status:", response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] [GMAIL-OAUTH] Token refresh failed:", error)
    throw new Error(`Failed to refresh token: ${error}`)
  }

  const tokens = await response.json()
  console.log("[v0] [GMAIL-OAUTH] Token refreshed successfully")
  console.log("[v0] [GMAIL-OAUTH] New access_token (first 50 chars):", tokens.access_token?.substring(0, 50))
  console.log("[v0] [GMAIL-OAUTH] Expires in:", tokens.expires_in, "seconds")

  const expiresAt = Date.now() + tokens.expires_in * 1000
  console.log("[v0] [GMAIL-OAUTH] New expires_at timestamp:", expiresAt)
  console.log("[v0] [GMAIL-OAUTH] New expires_at date:", new Date(expiresAt))

  try {
    const config = await getEmailProvider(accountId)
    if (config && config.provider === "gmail") {
      const settings = config.settings as GmailSettings
      await saveEmailProvider(accountId, "gmail", {
        ...settings,
        access_token: tokens.access_token,
        expires_at: expiresAt,
      })
      console.log("[v0] [GMAIL-OAUTH] Updated tokens saved to unified provider table")
    }
  } catch (error) {
    console.error("[v0] [GMAIL-OAUTH] Error saving refreshed tokens:", error)
    throw error
  }

  return tokens.access_token
}

export async function getGmailConfig(accountId: string): Promise<GmailConfig | null> {
  console.log("[v0] [GMAIL-OAUTH] Getting Gmail config for account:", accountId)

  try {
    const providerConfig = await getEmailProvider(accountId)

    if (!providerConfig || providerConfig.provider !== "gmail") {
      console.log("[v0] [GMAIL-OAUTH] No Gmail config found")
      return null
    }

    const settings = providerConfig.settings as GmailSettings
    const config: GmailConfig = {
      account_id: accountId,
      email: settings.email,
      access_token: settings.access_token,
      refresh_token: settings.refresh_token,
      expires_at: settings.expires_at,
    }

    console.log("[v0] [GMAIL-OAUTH] Config found for email:", config.email)
    console.log("[v0] [GMAIL-OAUTH] Access token (first 50 chars):", config.access_token?.substring(0, 50))
    console.log("[v0] [GMAIL-OAUTH] Refresh token (first 20 chars):", config.refresh_token?.substring(0, 20))
    console.log("[v0] [GMAIL-OAUTH] Expires at (raw):", config.expires_at)
    console.log("[v0] [GMAIL-OAUTH] Expires at (date):", safeDateToISO(config.expires_at) || "Invalid date")

    const expiresAt = config.expires_at ? Number(config.expires_at) : 0
    const now = Date.now()
    const bufferTime = 5 * 60 * 1000 // 5 minutes

    console.log("[v0] [GMAIL-OAUTH] Current time:", now)
    console.log("[v0] [GMAIL-OAUTH] Token expires at:", expiresAt)
    console.log("[v0] [GMAIL-OAUTH] Time until expiry:", expiresAt - now, "ms")

    if (!expiresAt || isNaN(expiresAt) || expiresAt < now + bufferTime) {
      console.log("[v0] [GMAIL-OAUTH] Token needs refresh - expired, expiring soon, or invalid date")
      const newAccessToken = await refreshGmailToken(config.refresh_token, accountId)

      const newExpiresAt = Date.now() + 3600 * 1000 // 1 hour from now
      console.log("[v0] [GMAIL-OAUTH] Returning refreshed config with new expires_at:", newExpiresAt)

      return {
        ...config,
        access_token: newAccessToken,
        expires_at: newExpiresAt,
      }
    }

    console.log("[v0] [GMAIL-OAUTH] Token is still valid, no refresh needed")
    return config
  } catch (error) {
    console.error("[v0] [GMAIL-OAUTH] Error getting Gmail config:", error)
    throw error
  }
}

export async function deleteGmailConfig(accountId: string): Promise<void> {
  console.log("[v0] [GMAIL-OAUTH] Deleting Gmail config for account:", accountId)

  try {
    await deleteEmailProvider(accountId)
    console.log("[v0] [GMAIL-OAUTH] Gmail config deleted successfully from unified provider table")
  } catch (error) {
    console.error("[v0] [GMAIL-OAUTH] Error deleting Gmail config:", error)
    throw error
  }
}

export async function getUserProfile(accessToken: string): Promise<{ email: string }> {
  console.log("[v0] [GMAIL-OAUTH] Getting user profile from Gmail API...")

  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    console.log("[v0] [GMAIL-OAUTH] User profile response status:", response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] [GMAIL-OAUTH] Failed to get user profile:", error)
      throw new Error("Failed to get user profile")
    }

    const data = await response.json()
    const email = data.emailAddress

    console.log("[v0] [GMAIL-OAUTH] User profile retrieved:")
    console.log("[v0] [GMAIL-OAUTH] Email:", email)

    return { email }
  } catch (error) {
    console.error("[v0] [GMAIL-OAUTH] Error getting user profile:", error)
    throw error
  }
}
