import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      account: {
        id: session.accountId,
        email: session.email,
        fullName: session.fullName,
      },
    })
  } catch (error) {
    console.error("[v0] Session error:", error)
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 })
  }
}
