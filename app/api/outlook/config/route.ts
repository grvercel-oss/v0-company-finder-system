import { NextResponse } from "next/server"
import { getOutlookConfig, deleteOutlookConfig } from "@/lib/outlook-oauth"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    if (!accountId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const config = await getOutlookConfig(accountId)

    if (!config) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      email: config.email,
    })
  } catch (error) {
    console.error("[v0] Error getting Outlook config:", error)
    return NextResponse.json({ error: "Failed to get config" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    if (!accountId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    await deleteOutlookConfig(accountId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting Outlook config:", error)
    return NextResponse.json({ error: "Failed to delete config" }, { status: 500 })
  }
}
