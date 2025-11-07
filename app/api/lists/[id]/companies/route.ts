import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// POST /api/lists/[id]/companies - Add a company to a list
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const listId = Number.parseInt(id)
    const body = await request.json()
    const { companyId, companyIds, notes } = body

    console.log("[v0] Adding companies to list", listId)

    const idsToAdd = companyIds || (companyId ? [companyId] : [])

    if (idsToAdd.length === 0) {
      return NextResponse.json({ error: "Company ID(s) required" }, { status: 400 })
    }

    let successCount = 0
    let duplicateCount = 0
    const errors: any[] = []

    for (const id of idsToAdd) {
      try {
        const result = await sql`
          INSERT INTO company_list_items (list_id, company_id, notes)
          VALUES (${listId}, ${id}, ${notes || null})
          ON CONFLICT (list_id, company_id) DO NOTHING
          RETURNING *
        `

        if (result.length > 0) {
          successCount++
        } else {
          duplicateCount++
        }
      } catch (error: any) {
        errors.push({ companyId: id, error: error.message })
      }
    }

    console.log("[v0] Bulk add complete:", successCount, "added,", duplicateCount, "duplicates")

    return NextResponse.json({
      success: true,
      added: successCount,
      duplicates: duplicateCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error("[v0] Error adding companies to list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/lists/[id]/companies - Fetch companies in a list
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const listId = Number.parseInt(id)

    const companies = await sql`
      SELECT c.* 
      FROM companies c
      INNER JOIN company_list_items cli ON c.id = cli.company_id
      WHERE cli.list_id = ${listId}
      ORDER BY cli.added_at DESC
    `

    return NextResponse.json({ companies })
  } catch (error: any) {
    console.error("[v0] Error fetching list companies:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/lists/[id]/companies/[companyId] - Remove a company from a list
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const listId = Number.parseInt(id)
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
