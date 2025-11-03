import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET single contact
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const contacts = await sql`
      SELECT * FROM contacts WHERE id = ${id}
    `

    if (contacts.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json({ contact: contacts[0] })
  } catch (error) {
    console.error("Error fetching contact:", error)
    return NextResponse.json({ error: "Failed to fetch contact" }, { status: 500 })
  }
}

// PATCH update contact
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const sanitizeTimestamp = (value: any) => {
      if (!value) return null
      const date = new Date(value)
      return isNaN(date.getTime()) ? null : date.toISOString()
    }

    const result = await sql`
      UPDATE contacts
      SET 
        email = COALESCE(${body.email}, email),
        first_name = COALESCE(${body.first_name}, first_name),
        last_name = COALESCE(${body.last_name}, last_name),
        company_name = COALESCE(${body.company_name}, company_name),
        job_title = COALESCE(${body.job_title}, job_title),
        subject = COALESCE(${body.subject}, subject),
        body = COALESCE(${body.body}, body),
        status = COALESCE(${body.status}, status),
        sent_at = COALESCE(${sanitizeTimestamp(body.sent_at)}, sent_at),
        failed_reason = COALESCE(${body.failed_reason}, failed_reason),
        reply_received_at = COALESCE(${sanitizeTimestamp(body.reply_received_at)}, reply_received_at),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json({ contact: result[0] })
  } catch (error) {
    console.error("Error updating contact:", error)
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
  }
}

// DELETE contact
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await sql`DELETE FROM contacts WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting contact:", error)
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
  }
}
