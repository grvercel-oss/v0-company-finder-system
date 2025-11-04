import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function POST(request: Request) {
  try {
    // Get account ID for RLS
    const accountId = await getAccountIdFromRequest(request)
    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { contactIds } = body

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: "Invalid contact IDs" }, { status: 400 })
    }

    // Delete contacts that belong to the user's account
    // First verify the contacts belong to campaigns owned by this account
    await sql`
      DELETE FROM contacts 
      WHERE id = ANY(${contactIds}::int[])
      AND campaign_id IN (
        SELECT id FROM campaigns WHERE account_id = ${accountId}
      )
    `

    return NextResponse.json({
      success: true,
      deletedCount: contactIds.length,
    })
  } catch (error) {
    console.error("Error bulk deleting contacts:", error)
    return NextResponse.json({ error: "Failed to delete contacts" }, { status: 500 })
  }
}
