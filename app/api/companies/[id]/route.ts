import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)

    const company = await sql`
      SELECT * FROM companies WHERE id = ${id}
    `

    if (company.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Get update history
    const updates = await sql`
      SELECT * FROM company_updates 
      WHERE company_id = ${id}
      ORDER BY updated_at DESC
      LIMIT 10
    `

    return NextResponse.json({
      success: true,
      company: company[0],
      updates,
    })
  } catch (error: any) {
    console.error("[v0] Company detail API error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch company" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const body = await request.json()

    // Update company
    const updated = await sql`
      UPDATE companies 
      SET 
        name = COALESCE(${body.name}, name),
        description = COALESCE(${body.description}, description),
        industry = COALESCE(${body.industry}, industry),
        location = COALESCE(${body.location}, location),
        website = COALESCE(${body.website}, website),
        verified = COALESCE(${body.verified}, verified),
        last_updated = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (updated.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Log the update
    await sql`
      INSERT INTO company_updates (company_id, update_type, changes)
      VALUES (${id}, 'updated', ${JSON.stringify(body)})
    `

    return NextResponse.json({
      success: true,
      company: updated[0],
    })
  } catch (error: any) {
    console.error("[v0] Company update API error:", error)
    return NextResponse.json({ error: error.message || "Failed to update company" }, { status: 500 })
  }
}
