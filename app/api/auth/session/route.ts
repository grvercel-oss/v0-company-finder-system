import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const result = await sql`
      SELECT email_verified FROM accounts WHERE id = ${session.accountId}
    `

    const emailVerified = result.length > 0 ? result[0].email_verified : false

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.accountId,
        email: session.email,
        fullName: session.fullName,
        emailVerified,
      },
    })
  } catch (error) {
    console.error("[v0] Session error:", error)
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 })
  }
}
