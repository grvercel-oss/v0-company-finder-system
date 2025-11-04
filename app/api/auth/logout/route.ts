import { NextResponse } from "next/server"
import { clearSession } from "@/lib/session"

export async function POST() {
  try {
    await clearSession()

    console.log("[v0] User logged out")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Logout error:", error)
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 })
  }
}
