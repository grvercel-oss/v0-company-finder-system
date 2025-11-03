import { sql } from "@/lib/db"
import { getEmailProvider, saveEmailProvider, deleteEmailProvider, type OutlookSettings } from "@/lib/email-provider"

export interface OutlookConfig {
  account_id: string
  email: string
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface OutlookTokenResponse {
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
  const clientId = process.env.OUTLOOK_CLIENT_ID || process.env.CLIENT_ID
  console.log("[v0] [OUTLOOK-OAUTH] Client ID exists:", !!clientId)
  if (!clientId) {
    throw new Error("OUTLOOK_CLIENT_ID or CLIENT_ID environment variable is required")
  }
  return clientId
}

const getClientSecret = () => {
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET || process.env.CLIENT_SECRET
  console.log("[v0] [OUTLOOK-OAUTH] Client Secret exists:", !!clientSecret)
  if (!clientSecret) {
    throw new Error("OUTLOOK_CLIENT_SECRET or CLIENT_SECRET environment variable is required")
  }
  return clientSecret
}

const getTenantId = () => {
  const tenantId = "common"
  console.log("[v0] [OUTLOOK-OAUTH] Tenant ID:", tenantId)
  return tenantId
}

const getRedirectUri = () => {
  const redirectUri = process.env.REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/outlook/oauth/callback`
  console.log("[v0] [OUTLOOK-OAUTH] Redirect URI:", redirectUri)
  if (!redirectUri || redirectUri.includes("undefined")) {
    throw new Error("REDIRECT_URI or NEXT_PUBLIC_APP_URL environment variable is required")
  }
  return redirectUri
}

const REQUIRED_SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "offline_access",
  "https://graph.microsoft.com/User.Read",
]

export function getOutlookAuthUrl(state: string): string {
  console.log("[v0] [OUTLOOK-OAUTH] Generating auth URL with random state for CSRF protection")

  const clientId = getClientId()
  const redirectUri = getRedirectUri()
  const tenantId = getTenantId()

  console.log("[v0] [OUTLOOK-OAUTH] OAuth config validated successfully")
  console.log("[v0] [OUTLOOK-OAUTH] Client ID:", clientId.substring(0, 8) + "...")
  console.log("[v0] [OUTLOOK-OAUTH] Redirect URI:", redirectUri)
  console.log("[v0] [OUTLOOK-OAUTH] Tenant ID:", tenantId)

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: REQUIRED_SCOPES.join(" "),
    state: state, // Now uses random state for CSRF protection
    response_mode: "query",
    prompt: "consent",
  })

  const fullUrl = `${authUrl}?${params.toString()}`
  console.log("[v0] [OUTLOOK-OAUTH] Generated auth URL (Authorization Code Flow):", fullUrl)

  return fullUrl
}

export async function exchangeCodeForTokens(code: string): Promise<OutlookTokenResponse> {
  console.log("[v0] [OUTLOOK-OAUTH] Exchanging authorization code for tokens...")
  console.log("[v0] [OUTLOOK-OAUTH] Code length:", code.length)

  const clientId = getClientId()
  const clientSecret = getClientSecret()
  const redirectUri = getRedirectUri()
  const tenantId = getTenantId()

  console.log("[v0] [OUTLOOK-OAUTH] OAuth config validated for token exchange")

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  console.log("[v0] [OUTLOOK-OAUTH] Token URL:", tokenUrl)

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: REQUIRED_SCOPES.join(" "),
  })

  console.log("[v0] [OUTLOOK-OAUTH] Making token exchange request with client_secret (Authorization Code Flow)...")

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  console.log("[v0] [OUTLOOK-OAUTH] Token exchange response status:", response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] [OUTLOOK-OAUTH] Token exchange failed with status:", response.status)
    console.error("[v0] [OUTLOOK-OAUTH] Error response:", error)
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  const tokens = await response.json()
  console.log("[v0] [OUTLOOK-OAUTH] Successfully obtained tokens")
  console.log("[v0] [OUTLOOK-OAUTH] Token type:", tokens.token_type)
  console.log("[v0] [OUTLOOK-OAUTH] Expires in:", tokens.expires_in, "seconds")
  console.log("[v0] [OUTLOOK-OAUTH] Scopes:", tokens.scope)

  return tokens
}

export async function refreshOutlookToken(refreshToken: string, accountId: string): Promise<string> {
  console.log("[v0] [OUTLOOK-OAUTH] Refreshing Outlook token...")
  console.log("[v0] [OUTLOOK-OAUTH] Refresh token (first 20 chars):", refreshToken.substring(0, 20))

  const clientId = getClientId()
  const clientSecret = getClientSecret()
  const tenantId = getTenantId()

  console.log("[v0] [OUTLOOK-OAUTH] OAuth config validated for token refresh")

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: REQUIRED_SCOPES.join(" "),
  })

  console.log("[v0] [OUTLOOK-OAUTH] Making token refresh request...")

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  console.log("[v0] [OUTLOOK-OAUTH] Token refresh response status:", response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] [OUTLOOK-OAUTH] Token refresh failed:", error)
    throw new Error(`Failed to refresh token: ${error}`)
  }

  const tokens = await response.json()
  console.log("[v0] [OUTLOOK-OAUTH] Token refreshed successfully")
  console.log("[v0] [OUTLOOK-OAUTH] New access_token (first 50 chars):", tokens.access_token?.substring(0, 50))
  console.log("[v0] [OUTLOOK-OAUTH] New refresh_token (first 20 chars):", tokens.refresh_token?.substring(0, 20))
  console.log("[v0] [OUTLOOK-OAUTH] Expires in:", tokens.expires_in, "seconds")

  const expiresAt = Date.now() + tokens.expires_in * 1000
  console.log("[v0] [OUTLOOK-OAUTH] New expires_at timestamp:", expiresAt)
  console.log("[v0] [OUTLOOK-OAUTH] New expires_at date:", new Date(expiresAt))

  try {
    const config = await getEmailProvider(accountId)
    if (config && config.provider === "outlook") {
      const settings = config.settings as OutlookSettings
      await saveEmailProvider(accountId, "outlook", {
        ...settings,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      })
      console.log("[v0] [OUTLOOK-OAUTH] Updated tokens saved to unified provider table")
    }
  } catch (error) {
    console.error("[v0] [OUTLOOK-OAUTH] Error saving refreshed tokens:", error)
    throw error
  }

  return tokens.access_token
}

export async function getOutlookConfig(accountId: string): Promise<OutlookConfig | null> {
  console.log("[v0] [OUTLOOK-OAUTH] Getting Outlook config for account:", accountId)

  try {
    const providerConfig = await getEmailProvider(accountId)

    if (!providerConfig || providerConfig.provider !== "outlook") {
      console.log("[v0] [OUTLOOK-OAUTH] No Outlook config found")
      return null
    }

    const settings = providerConfig.settings as OutlookSettings
    const config: OutlookConfig = {
      account_id: accountId,
      email: settings.email,
      access_token: settings.access_token,
      refresh_token: settings.refresh_token,
      expires_at: settings.expires_at,
    }

    console.log("[v0] [OUTLOOK-OAUTH] Config found for email:", config.email)
    console.log("[v0] [OUTLOOK-OAUTH] Access token (first 50 chars):", config.access_token?.substring(0, 50))
    console.log("[v0] [OUTLOOK-OAUTH] Refresh token (first 20 chars):", config.refresh_token?.substring(0, 20))
    console.log("[v0] [OUTLOOK-OAUTH] Expires at (raw):", config.expires_at)
    console.log("[v0] [OUTLOOK-OAUTH] Expires at (date):", safeDateToISO(config.expires_at) || "Invalid date")

    const expiresAt = config.expires_at ? Number(config.expires_at) : 0
    const now = Date.now()
    const bufferTime = 5 * 60 * 1000 // 5 minutes

    console.log("[v0] [OUTLOOK-OAUTH] Current time:", now)
    console.log("[v0] [OUTLOOK-OAUTH] Token expires at:", expiresAt)
    console.log("[v0] [OUTLOOK-OAUTH] Time until expiry:", expiresAt - now, "ms")

    if (!expiresAt || isNaN(expiresAt) || expiresAt < now + bufferTime) {
      console.log("[v0] [OUTLOOK-OAUTH] Token needs refresh - expired, expiring soon, or invalid date")
      const newAccessToken = await refreshOutlookToken(config.refresh_token, accountId)

      const newExpiresAt = Date.now() + 3600 * 1000 // 1 hour from now
      console.log("[v0] [OUTLOOK-OAUTH] Returning refreshed config with new expires_at:", newExpiresAt)

      return {
        ...config,
        access_token: newAccessToken,
        expires_at: newExpiresAt,
      }
    }

    console.log("[v0] [OUTLOOK-OAUTH] Token is still valid, no refresh needed")
    return config
  } catch (error) {
    console.error("[v0] [OUTLOOK-OAUTH] Error getting Outlook config:", error)
    throw error
  }
}

export async function deleteOutlookConfig(accountId: string): Promise<void> {
  console.log("[v0] [OUTLOOK-OAUTH] Deleting Outlook config for account:", accountId)

  try {
    await deleteEmailProvider(accountId)
    console.log("[v0] [OUTLOOK-OAUTH] Outlook config deleted successfully from unified provider table")
  } catch (error) {
    console.error("[v0] [OUTLOOK-OAUTH] Error deleting Outlook config:", error)
    throw error
  }
}

export async function deleteOutlookConfigByEmail(email: string): Promise<void> {
  console.log("[v0] [OUTLOOK-OAUTH] Deleting Outlook config for email:", email)

  try {
    const result = await sql`
      SELECT account_id FROM account_email_provider
      WHERE provider = 'outlook' 
      AND settings->>'email' = ${email}
      LIMIT 1
    `

    if (result.length > 0) {
      await deleteEmailProvider(result[0].account_id)
      console.log("[v0] [OUTLOOK-OAUTH] Outlook config deleted successfully")
    }
  } catch (error) {
    console.error("[v0] [OUTLOOK-OAUTH] Error deleting Outlook config:", error)
    throw error
  }
}

export async function getUserProfile(accessToken: string): Promise<{ email: string; displayName: string }> {
  console.log("[v0] [OUTLOOK-OAUTH] Getting user profile from Microsoft Graph...")

  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    console.log("[v0] [OUTLOOK-OAUTH] User profile response status:", response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] [OUTLOOK-OAUTH] Failed to get user profile:", error)
      throw new Error("Failed to get user profile")
    }

    const data = await response.json()
    const email = data.mail || data.userPrincipalName
    const displayName = data.displayName

    console.log("[v0] [OUTLOOK-OAUTH] User profile retrieved:")
    console.log("[v0] [OUTLOOK-OAUTH] Email:", email)
    console.log("[v0] [OUTLOOK-OAUTH] Display name:", displayName)

    return { email, displayName }
  } catch (error) {
    console.error("[v0] [OUTLOOK-OAUTH] Error getting user profile:", error)
    throw error
  }
}
