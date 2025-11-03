import { NextResponse } from "next/server"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { getEmailProvider, deleteEmailProvider } from "@/lib/email-provider"
import type { ZohoSettings } from "@/lib/email-provider"

export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    if (!accountId) {
      return NextResponse.json({ connected: false })
    }

    const providerConfig = await getEmailProvider(accountId)

    if (!providerConfig || providerConfig.provider !== "zoho") {
      return NextResponse.json({ connected: false })
    }

    const settings = providerConfig.settings as ZohoSettings
    return NextResponse.json({
      connected: true,
      data_center: settings.data_center,
      account_email: settings.email,
      account_name: settings.account_name,
    })
  } catch (error) {
    console.error("[v0] Error fetching config:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await deleteEmailProvider(accountId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting config:", error)
    return NextResponse.json({ error: "Failed to delete configuration" }, { status: 500 })
  }
}
