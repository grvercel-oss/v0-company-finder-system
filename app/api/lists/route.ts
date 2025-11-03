import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { initializeDatabase } from "@/lib/db-init"

// GET /api/lists - Get all company lists
export async function GET() {
  try {
    console.log("[v0] Fetching all company lists")

    const lists = await sql`
      SELECT 
        cl.*,
        COUNT(cli.id) as company_count
      FROM company_lists cl
      LEFT JOIN company_list_items cli ON cl.id = cli.list_id
      GROUP BY cl.id
      ORDER BY cl.created_at DESC
    `

    console.log("[v0] Found", lists.length, "lists")

    return NextResponse.json({ lists })
  } catch (error: any) {
    console.error("[v0] Error fetching lists:", error.message)

    if (error.message.includes("does not exist")) {
      console.log("[v0] Tables missing, initializing database...")
      const initResult = await initializeDatabase()

      if (initResult.success) {
        console.log("[v0] Database initialized, retrying query...")
        try {
          const lists = await sql`
            SELECT 
              cl.*,
              COUNT(cli.id) as company_count
            FROM company_lists cl
            LEFT JOIN company_list_items cli ON cl.id = cli.list_id
            GROUP BY cl.id
            ORDER BY cl.created_at DESC
          `
          return NextResponse.json({ lists })
        } catch (retryError: any) {
          console.error("[v0] Retry failed:", retryError.message)
          return NextResponse.json({ lists: [], error: retryError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ lists: [], error: error.message }, { status: 500 })
  }
}

// POST /api/lists - Create a new company list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body

    console.log("[v0] Creating new list:", name)

    if (!name) {
      return NextResponse.json({ error: "List name is required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO company_lists (name, description)
      VALUES (${name}, ${description || null})
      RETURNING *
    `

    console.log("[v0] List created successfully:", result[0].id)

    return NextResponse.json({ list: result[0] })
  } catch (error: any) {
    console.error("[v0] Error creating list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
