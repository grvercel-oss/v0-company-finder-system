import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

// POST create campaign from list with all companies and contacts
export async function POST(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)
    const body = await request.json()
    const { listId, listName } = body

    if (!listId) {
      return NextResponse.json({ error: "List ID is required" }, { status: 400 })
    }

    console.log("[v0] Creating campaign from list", listId)

    // Get all companies in the list
    const companies = await sql`
      SELECT c.* 
      FROM companies c
      INNER JOIN company_list_items cli ON c.id = cli.company_id
      WHERE cli.list_id = ${listId}
    `

    if (companies.length === 0) {
      return NextResponse.json({ error: "No companies in this list" }, { status: 400 })
    }

    console.log("[v0] Found", companies.length, "companies in list")

    // Get all contacts for these companies
    const companyIds = companies.map((c) => c.id)
    const contacts = await sql`
      SELECT * FROM company_contacts
      WHERE company_id = ANY(${companyIds})
      AND email_verification_status != 'invalid'
    `

    console.log("[v0] Found", contacts.length, "contacts for companies")

    // Create the campaign
    const campaignName = `${listName || "List"} Campaign - ${new Date().toLocaleDateString()}`
    const campaignResult = await sql`
      INSERT INTO campaigns (name, description, status, account_id)
      VALUES (
        ${campaignName},
        ${`Campaign created from list "${listName}" with ${companies.length} companies and ${contacts.length} contacts`},
        'draft',
        ${accountId}
      )
      RETURNING *
    `

    const campaign = campaignResult[0]
    console.log("[v0] Created campaign", campaign.id)

    // Link contacts to the campaign (if contacts table has campaign_id)
    if (contacts.length > 0) {
      // Note: This assumes your contacts table can be linked to campaigns
      // You may need to adjust this based on your actual schema
      await sql`
        UPDATE company_contacts
        SET campaign_id = ${campaign.id}
        WHERE id = ANY(${contacts.map((c) => c.id)})
      `
      console.log("[v0] Linked", contacts.length, "contacts to campaign")
    }

    return NextResponse.json({
      campaign,
      companiesCount: companies.length,
      contactsCount: contacts.length,
    })
  } catch (error: any) {
    console.error("[v0] Error creating campaign from list:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
