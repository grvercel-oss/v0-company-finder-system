import { type NextRequest, NextResponse } from "next/server"
import { getZohoUrls, getPlatformCredentials } from "@/lib/zoho-oauth"
import { saveEmailProvider } from "@/lib/email-provider"
import type { ZohoSettings } from "@/lib/email-provider"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { currentUser } from "@clerk/nextjs/server"
import { syncClerkUser } from "@/lib/clerk-sync"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  const searchParams = url.searchParams
  const code = searchParams.get("code")
  const dataCenter = searchParams.get("state") || "com"
  const error = searchParams.get("error")

  if (error) {
    console.error("[v0] OAuth error:", error)
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?error=no_code`)
  }

  try {
    const user = await currentUser()
    if (user) {
      const email = user.emailAddresses[0]?.emailAddress || ""
      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || email
      await syncClerkUser(user.id, email, fullName)
      console.log("[v0] [ZOHO-CALLBACK] Synced Clerk user to accounts table:", user.id)
    }
  } catch (syncError) {
    console.error("[v0] [ZOHO-CALLBACK] Error syncing Clerk user:", syncError)
    // Continue anyway - getAccountIdFromRequest will handle it
  }

  const accountId = await getAccountIdFromRequest(request)

  if (!accountId) {
    console.error("[v0] [ZOHO-CALLBACK] No account_id in session - user must be logged in")
    return NextResponse.redirect(`${origin}/login?error=not_authenticated`)
  }

  console.log("[v0] [ZOHO-CALLBACK] Using account_id from session:", accountId)

  try {
    const { clientId, clientSecret } = getPlatformCredentials()
    const urls = getZohoUrls(dataCenter)
    const redirectUri = `${origin}/api/zoho/oauth/callback`

    console.log("[v0] Token exchange - redirect URI:", redirectUri)
    console.log("[v0] Token exchange - data center:", dataCenter)

    const tokenResponse = await fetch(`${urls.accounts}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error("[v0] Token exchange failed:", errorText)
      return NextResponse.redirect(`${origin}/settings?error=token_exchange_failed: ${encodeURIComponent(errorText)}`)
    }

    const tokenData = await tokenResponse.json()

    if (!tokenData.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?error=no_refresh_token`)
    }

    console.log("[v0] Token exchange successful, fetching account info...")

    const accountResponse = await fetch(`${urls.mail}/api/accounts`, {
      headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` },
    })

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text()
      console.error("[v0] Failed to fetch account info:", errorText)
      return NextResponse.redirect(`${origin}/settings?error=account_fetch_failed: ${encodeURIComponent(errorText)}`)
    }

    const accountData = await accountResponse.json()
    console.log("[v0] Account data received:", JSON.stringify(accountData, null, 2))

    if (!accountData.data || !Array.isArray(accountData.data) || accountData.data.length === 0) {
      return NextResponse.redirect(`${origin}/settings?error=no_account_data`)
    }

    const primaryAccount = accountData.data.find((acc: any) => acc.isPrimary) || accountData.data[0]
    const zohoAccountId = primaryAccount.accountId
    const accountEmail = primaryAccount.primaryEmailAddress
    const accountName = primaryAccount.displayName

    console.log("[v0] Account info extracted:", { zohoAccountId, accountEmail, accountName })

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000)

    const zohoSettings: ZohoSettings = {
      email: accountEmail,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      data_center: dataCenter,
      zoho_account_id: zohoAccountId,
      account_name: accountName || undefined,
      is_active: true,
    }

    await saveEmailProvider(accountId, "zoho", zohoSettings)

    console.log("[v0] Zoho configuration saved successfully to unified provider table")

    console.log("[v0] [ZOHO-CALLBACK] Redirecting to settings with success message")
    const response = NextResponse.redirect(`${origin}/settings?success=zoho_connected`)
    return response
  } catch (error: any) {
    console.error("[v0] OAuth callback error:", error)
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(error.message || String(error))}`)
  }
}
