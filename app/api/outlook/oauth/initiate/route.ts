import { NextResponse } from "next/server"
import { getOutlookAuthUrl } from "@/lib/outlook-oauth"
import { randomBytes } from "crypto"

// No longer uses account_id in state - account will be created/found during callback
export async function GET(request: Request) {
  console.log("[v0] [OUTLOOK-INIT] Starting Outlook OAuth initiation...")

  try {
    const state = randomBytes(32).toString("hex")
    console.log("[v0] [OUTLOOK-INIT] Generated random state for CSRF protection:", state.substring(0, 16) + "...")

    const response = NextResponse.redirect(getOutlookAuthUrl(state))
    response.cookies.set("oauth_state", state, {
      path: "/",
      maxAge: 600, // 10 minutes
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    console.log("[v0] [OUTLOOK-INIT] State stored in cookie, redirecting to Outlook OAuth...")
    return response
  } catch (error) {
    console.error("[v0] [OUTLOOK-INIT] Error initiating Outlook OAuth:", error)
    if (error instanceof Error) {
      console.error("[v0] [OUTLOOK-INIT] Error message:", error.message)
      console.error("[v0] [OUTLOOK-INIT] Error stack:", error.stack)
    }
    return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 })
  }
}
