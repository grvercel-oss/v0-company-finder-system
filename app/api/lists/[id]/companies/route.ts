import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// POST /api/lists/[id]/companies - Add a company to a list
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listId = Number.parseInt(params.id)
    const body = await request.json()
    const { companyId, notes } = body

    console.log("[v0] Adding company", companyId, "to list", listId)

    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO company_list_items (list_id, company_id, notes)
      VALUES (${listId}, ${companyId}, ${notes || null})
      ON CONFLICT (list_id, company_id) DO NOTHING
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Company already in list" }, { status: 409 })
    }

    console.log("[v0] Company added to list successfully")

    return NextResponse.json({ success: true, item: result[0] })
  } catch (error: any) {
    console.error("[v0] Error adding company to list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/lists/[id]/companies/[companyId] - Remove a company from a list
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listId = Number.parseInt(params.id)
    const url = new URL(request.url)
    const companyId = url.searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 })
    }

    console.log("[v0] Removing company", companyId, "from list", listId)

    await sql`
      DELETE FROM company_list_items 
      WHERE list_id = ${listId} AND company_id = ${Number.parseInt(companyId)}
    `

    console.log("[v0] Company removed from list successfully")

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error removing company from list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
