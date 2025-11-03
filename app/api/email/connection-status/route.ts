import { NextResponse } from "next/server"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { getEmailProvider } from "@/lib/email-provider"
import type { ZohoSettings, OutlookSettings } from "@/lib/email-provider"

export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    const providerConfig = await getEmailProvider(accountId)

    if (!providerConfig) {
      return NextResponse.json({
        connected: false,
        provider: null,
        email: null,
      })
    }

    if (providerConfig.provider === "zoho") {
      const settings = providerConfig.settings as ZohoSettings
      return NextResponse.json({
        connected: true,
        provider: "zoho",
        email: settings.email,
        name: settings.account_name,
      })
    } else {
      const settings = providerConfig.settings as OutlookSettings
      return NextResponse.json({
        connected: true,
        provider: "outlook",
        email: settings.email,
      })
    }
  } catch (error) {
    console.error("[v0] Error checking connection status:", error)
    return NextResponse.json({ error: "Failed to check connection status" }, { status: 500 })
  }
}
