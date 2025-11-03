import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET /api/lists/[id] - Get a specific list with its companies
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listId = Number.parseInt(params.id)
    console.log("[v0] Fetching list:", listId)

    const listResult = await sql`
      SELECT * FROM company_lists WHERE id = ${listId}
    `

    if (listResult.length === 0) {
      return NextResponse.json({ error: "List not found" }, { status: 404 })
    }

    const companies = await sql`
      SELECT 
        c.*,
        cli.added_at,
        cli.notes
      FROM companies c
      INNER JOIN company_list_items cli ON c.id = cli.company_id
      WHERE cli.list_id = ${listId}
      ORDER BY cli.added_at DESC
    `

    console.log("[v0] Found", companies.length, "companies in list")

    return NextResponse.json({
      list: listResult[0],
      companies,
    })
  } catch (error: any) {
    console.error("[v0] Error fetching list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/lists/[id] - Delete a list
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listId = Number.parseInt(params.id)
    console.log("[v0] Deleting list:", listId)

    await sql`DELETE FROM company_lists WHERE id = ${listId}`

    console.log("[v0] List deleted successfully")

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error deleting list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/lists/[id] - Update a list
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listId = Number.parseInt(params.id)
    const body = await request.json()
    const { name, description } = body

    console.log("[v0] Updating list:", listId)

    const result = await sql`
      UPDATE company_lists 
      SET 
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${listId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "List not found" }, { status: 404 })
    }

    console.log("[v0] List updated successfully")

    return NextResponse.json({ list: result[0] })
  } catch (error: any) {
    console.error("[v0] Error updating list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
