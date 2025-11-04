import { NextResponse } from "next/server"
import { exchangeCodeForTokens, getUserProfile } from "@/lib/outlook-oauth"
import { saveEmailProvider, type OutlookSettings } from "@/lib/email-provider"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function GET(request: Request) {
  console.log("[v0] [OUTLOOK-CALLBACK] Outlook OAuth callback received")

  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  console.log("[v0] [OUTLOOK-CALLBACK] Callback params:", {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
    errorDescription,
  })

  if (error) {
    console.error("[v0] [OUTLOOK-CALLBACK] OAuth error:", error)
    console.error("[v0] [OUTLOOK-CALLBACK] Error description:", errorDescription)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=oauth_failed&details=${error}`)
  }

  if (!code || !state) {
    console.error("[v0] [OUTLOOK-CALLBACK] Missing required params - code:", !!code, "state:", !!state)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=missing_params`)
  }

  const cookies = request.headers.get("cookie")
  const storedState = cookies
    ?.split(";")
    .find((c) => c.trim().startsWith("oauth_state="))
    ?.split("=")[1]

  if (!storedState || storedState !== state) {
    console.error("[v0] [OUTLOOK-CALLBACK] State mismatch - possible CSRF attack")
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=invalid_state`)
  }

  console.log("[v0] [OUTLOOK-CALLBACK] State verified successfully")

  const accountId = await getAccountIdFromRequest(request)

  if (!accountId) {
    console.error("[v0] [OUTLOOK-CALLBACK] No account_id in session - user must be logged in")
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=not_authenticated`)
  }

  console.log("[v0] [OUTLOOK-CALLBACK] Using account_id from session:", accountId)

  try {
    console.log("[v0] [OUTLOOK-CALLBACK] Exchanging code for tokens...")
    const tokens = await exchangeCodeForTokens(code)
    console.log("[v0] [OUTLOOK-CALLBACK] Tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
    })

    console.log("[v0] [OUTLOOK-CALLBACK] Getting user profile from Microsoft Graph...")
    const profile = await getUserProfile(tokens.access_token)
    console.log("[v0] [OUTLOOK-CALLBACK] User profile received:", {
      email: profile.email,
      displayName: profile.displayName,
    })

    const expiresAt = Date.now() + tokens.expires_in * 1000
    const settings: OutlookSettings = {
      email: profile.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    }

    console.log("[v0] [OUTLOOK-CALLBACK] Saving Outlook provider config to account_email_provider...")
    await saveEmailProvider(accountId, "outlook", settings)
    console.log("[v0] [OUTLOOK-CALLBACK] Provider config saved successfully")

    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?success=outlook_connected`)
    response.cookies.delete("oauth_state")

    console.log("[v0] [OUTLOOK-CALLBACK] OAuth flow completed successfully")
    return response
  } catch (error) {
    console.error("[v0] [OUTLOOK-CALLBACK] Error in Outlook OAuth callback:", error)
    if (error instanceof Error) {
      console.error("[v0] [OUTLOOK-CALLBACK] Error message:", error.message)
      console.error("[v0] [OUTLOOK-CALLBACK] Error stack:", error.stack)
    }
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=oauth_failed`)
  }
}
