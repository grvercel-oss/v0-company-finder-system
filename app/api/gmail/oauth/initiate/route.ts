import { type NextRequest, NextResponse } from "next/server"
import { getGmailAuthUrl } from "@/lib/gmail-oauth"
import { randomBytes } from "crypto"

export async function GET(request: NextRequest) {
  console.log("[v0] [GMAIL-OAUTH-INIT] Gmail OAuth initiation request received")

  try {
    // Generate random state for CSRF protection
    const state = randomBytes(32).toString("hex")
    console.log("[v0] [GMAIL-OAUTH-INIT] Generated state for CSRF protection")

    const authUrl = getGmailAuthUrl(state)
    console.log("[v0] [GMAIL-OAUTH-INIT] Redirecting to Gmail OAuth URL")

    // Store state in cookie for verification in callback
    const response = NextResponse.redirect(authUrl)
    response.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    })

    return response
  } catch (error) {
    console.error("[v0] [GMAIL-OAUTH-INIT] Error initiating Gmail OAuth:", error)
    return NextResponse.json({ error: "Failed to initiate Gmail OAuth" }, { status: 500 })
  }
}
