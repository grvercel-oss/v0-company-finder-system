import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { initializeDatabase } from "@/lib/db-init"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

// GET /api/lists - Get all company lists
export async function GET(request: NextRequest) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    console.log("[v0] Fetching company lists for account:", accountId)

    const lists = await sql`
      SELECT 
        cl.*,
        COUNT(cli.id)::integer as company_count
      FROM company_lists cl
      LEFT JOIN company_list_items cli ON cl.id = cli.list_id
      WHERE cl.account_id = ${accountId}
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
          const accountId = await getAccountIdFromRequest(request)
          const lists = await sql`
            SELECT 
              cl.*,
              COUNT(cli.id)::integer as company_count
            FROM company_lists cl
            LEFT JOIN company_list_items cli ON cl.id = cli.list_id
            WHERE cl.account_id = ${accountId}
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
    const accountId = await getAccountIdFromRequest(request)
    const body = await request.json()
    const { name, description, icon = "folder", color = "gray" } = body

    console.log("[v0] Creating new list:", name, "for account:", accountId)

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "List name is required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO company_lists (name, description, icon, color, account_id, created_at, updated_at)
      VALUES (${name.trim()}, ${description?.trim() || null}, ${icon}, ${color}, ${accountId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `

    if (result.length === 0) {
      throw new Error("Failed to create list - no rows returned")
    }

    console.log("[v0] List created successfully:", result[0].id)

    return NextResponse.json({ list: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Error creating list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
