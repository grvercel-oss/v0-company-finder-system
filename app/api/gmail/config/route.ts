import { NextResponse } from "next/server"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { getGmailConfig } from "@/lib/gmail-oauth"
import { deleteEmailProvider } from "@/lib/email-provider"

export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)
    const config = await getGmailConfig(accountId)

    if (!config) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      email: config.email,
    })
  } catch (error) {
    console.error("[v0] Error fetching Gmail config:", error)
    return NextResponse.json({ error: "Failed to fetch Gmail configuration" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)
    await deleteEmailProvider(accountId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error disconnecting Gmail:", error)
    return NextResponse.json({ error: "Failed to disconnect Gmail" }, { status: 500 })
  }
}
