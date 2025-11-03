import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const replyId = Number.parseInt(params.id)

    await sql`
      UPDATE replies
      SET notification_shown = true, notification_shown_at = NOW()
      WHERE id = ${replyId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error dismissing notification:", error)
    return NextResponse.json({ error: "Failed to dismiss notification" }, { status: 500 })
  }
}
