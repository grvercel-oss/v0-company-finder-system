import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { contactIds } = body

    if (!contactIds || !Array.isArray(contactIds)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    // Reset failed contacts back to 'generated' status so they can be resent
    for (const contactId of contactIds) {
      await sql`
        UPDATE contacts
        SET 
          status = 'generated',
          failed_reason = NULL,
          updated_at = NOW()
        WHERE id = ${contactId} AND status = 'failed'
      `
    }

    return NextResponse.json({ success: true, message: `Reset ${contactIds.length} contacts for retry` })
  } catch (error) {
    console.error("Error resetting contacts:", error)
    return NextResponse.json({ error: "Failed to reset contacts", details: String(error) }, { status: 500 })
  }
}
