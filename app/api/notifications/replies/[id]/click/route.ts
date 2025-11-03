import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const replyId = Number.parseInt(params.id)

    await sql`
      UPDATE replies
      SET notification_clicked = true
      WHERE id = ${replyId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error marking notification as clicked:", error)
    return NextResponse.json({ error: "Failed to mark notification as clicked" }, { status: 500 })
  }
}
