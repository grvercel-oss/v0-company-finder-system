import { type NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, getUserProfile } from "@/lib/gmail-oauth"
import { saveEmailProvider } from "@/lib/email-provider"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  console.log("[v0] [GMAIL-OAUTH-CALLBACK] Gmail OAuth callback received")

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  console.log("[v0] [GMAIL-OAUTH-CALLBACK] Code exists:", !!code)
  console.log("[v0] [GMAIL-OAUTH-CALLBACK] State:", state)
  console.log("[v0] [GMAIL-OAUTH-CALLBACK] Error:", error)

  // Verify state for CSRF protection
  const storedState = request.cookies.get("gmail_oauth_state")?.value
  if (!state || state !== storedState) {
    console.error("[v0] [GMAIL-OAUTH-CALLBACK] State mismatch - possible CSRF attack")
    return NextResponse.redirect(new URL("/settings?error=invalid_state", request.url))
  }

  if (error) {
    console.error("[v0] [GMAIL-OAUTH-CALLBACK] OAuth error:", error)
    return NextResponse.redirect(new URL(`/settings?error=${error}`, request.url))
  }

  if (!code) {
    console.error("[v0] [GMAIL-OAUTH-CALLBACK] No authorization code received")
    return NextResponse.redirect(new URL("/settings?error=no_code", request.url))
  }

  try {
    console.log("[v0] [GMAIL-OAUTH-CALLBACK] Exchanging code for tokens...")
    const tokens = await exchangeCodeForTokens(code)

    console.log("[v0] [GMAIL-OAUTH-CALLBACK] Getting user profile...")
    const profile = await getUserProfile(tokens.access_token)

    console.log("[v0] [GMAIL-OAUTH-CALLBACK] User email:", profile.email)

    // Check if account exists with this email
    const existingAccount = await sql`
      SELECT account_id FROM accounts WHERE email = ${profile.email} LIMIT 1
    `

    let accountId: string

    if (existingAccount.length > 0) {
      accountId = existingAccount[0].account_id
      console.log("[v0] [GMAIL-OAUTH-CALLBACK] Found existing account:", accountId)
    } else {
      // Create new account
      const newAccount = await sql`
        INSERT INTO accounts (email, name, created_at)
        VALUES (${profile.email}, ${profile.email.split("@")[0]}, NOW())
        RETURNING account_id
      `
      accountId = newAccount[0].account_id
      console.log("[v0] [GMAIL-OAUTH-CALLBACK] Created new account:", accountId)
    }

    const expiresAt = Date.now() + tokens.expires_in * 1000

    console.log("[v0] [GMAIL-OAUTH-CALLBACK] Saving Gmail provider configuration...")
    await saveEmailProvider(accountId, "gmail", {
      email: profile.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    })

    console.log("[v0] [GMAIL-OAUTH-CALLBACK] Gmail connected successfully")

    // Set account_id cookie and redirect to settings
    const response = NextResponse.redirect(new URL("/settings?success=gmail_connected", request.url))
    response.cookies.set("account_id", accountId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })
    // Clear the state cookie
    response.cookies.delete("gmail_oauth_state")

    return response
  } catch (error) {
    console.error("[v0] [GMAIL-OAUTH-CALLBACK] Error in Gmail OAuth callback:", error)
    return NextResponse.redirect(new URL("/settings?error=gmail_connection_failed", request.url))
  }
}
