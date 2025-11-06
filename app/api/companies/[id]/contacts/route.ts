import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const companyId = Number.parseInt(id)

    if (Number.isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid company ID" }, { status: 400 })
    }

    const contacts = await sql`
      SELECT * FROM company_contacts
      WHERE company_id = ${companyId}
      ORDER BY confidence_score DESC, created_at DESC
    `

    return NextResponse.json(contacts)
  } catch (error) {
    console.error("Error fetching contacts:", error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}
