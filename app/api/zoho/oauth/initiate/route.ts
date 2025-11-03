import { type NextRequest, NextResponse } from "next/server"
import { getZohoUrls, getPlatformCredentials } from "@/lib/zoho-oauth"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const origin = `${url.protocol}//${url.host}`

    console.log("[v0] OAuth initiate - origin:", origin)

    const { clientId, dataCenter } = getPlatformCredentials()
    const urls = getZohoUrls(dataCenter)
    const redirectUri = `${origin}/api/zoho/oauth/callback`

    console.log("[v0] OAuth initiate - redirect URI:", redirectUri)
    console.log("[v0] OAuth initiate - data center:", dataCenter)

    const authUrl = new URL(`${urls.accounts}/oauth/v2/auth`)
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", "ZohoMail.messages.ALL,ZohoMail.accounts.READ,ZohoMail.folders.READ")
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("state", dataCenter)

    console.log("[v0] Redirecting to:", authUrl.toString())

    return NextResponse.redirect(authUrl.toString())
  } catch (error: any) {
    console.error("[v0] OAuth initiate error:", error)
    try {
      const url = new URL(request.url)
      const origin = `${url.protocol}//${url.host}`
      return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(error.message)}`)
    } catch {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
}
