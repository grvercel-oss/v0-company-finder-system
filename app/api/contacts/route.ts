import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

// POST import contacts from CSV
export async function POST(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    const body = await request.json()
    const { campaignId, contacts } = body

    if (!campaignId || !contacts || !Array.isArray(contacts)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    // Insert contacts in batch
    const insertedContacts = []
    for (const contact of contacts) {
      const result = await sql`
        INSERT INTO contacts (
          campaign_id, email, first_name, last_name, 
          company_name, job_title, status, account_id
        )
        VALUES (
          ${campaignId}, 
          ${contact.email}, 
          ${contact.first_name || ""}, 
          ${contact.last_name || ""}, 
          ${contact.company_name || ""}, 
          ${contact.job_title || ""}, 
          'pending',
          ${accountId}
        )
        RETURNING *
      `
      insertedContacts.push(result[0])
    }

    return NextResponse.json({
      success: true,
      count: insertedContacts.length,
      contacts: insertedContacts,
    })
  } catch (error) {
    console.error("Error importing contacts:", error)
    return NextResponse.json({ error: "Failed to import contacts" }, { status: 500 })
  }
}
