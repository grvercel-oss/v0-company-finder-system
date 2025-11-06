import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const companyId = Number.parseInt(id)

    if (Number.isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid company ID" }, { status: 400 })
    }

    console.log(`[v0] [CONTACTS API] Fetching contacts for company ${companyId}`)

    const contacts = await sql`
      SELECT * FROM company_contacts
      WHERE company_id = ${companyId}
      ORDER BY confidence_score DESC, created_at DESC
    `

    console.log(`[v0] [CONTACTS API] Found ${contacts.length} contacts for company ${companyId}`)
    console.log(
      `[v0] [CONTACTS API] Contact details:`,
      contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        status: c.email_verification_status,
      })),
    )

    return NextResponse.json(contacts)
  } catch (error) {
    console.error("[v0] [CONTACTS API] Error fetching contacts:", error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}
