import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// PUT update contact email content
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const contactId = Number.parseInt(params.id)
    const body = await request.json()
    const { subject, body: emailBody } = body

    if (!subject || !emailBody) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 })
    }

    // Get current contact to store original if not already stored
    const contacts = await sql`SELECT * FROM contacts WHERE id = ${contactId}`
    if (contacts.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const contact = contacts[0]

    // Store original content if this is the first edit
    const originalSubject = contact.original_subject || contact.subject
    const originalBody = contact.original_body || contact.body

    // Update contact with edited content
    const result = await sql`
      UPDATE contacts
      SET 
        subject = ${subject},
        body = ${emailBody},
        original_subject = ${originalSubject},
        original_body = ${originalBody},
        edited_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${contactId}
      RETURNING *
    `

    return NextResponse.json({ contact: result[0] })
  } catch (error) {
    console.error("[v0] Error updating contact:", error)
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
  }
}
