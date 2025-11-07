import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function POST(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)
    const body = await request.json()
    const {
      campaignId,
      companyId,
      companyName,
      email,
      firstName,
      lastName,
      position,
      department,
      linkedin,
      twitter,
      source,
    } = body

    console.log("[v0] Adding contact to campaign", { campaignId, email, companyName })

    if (!campaignId || !companyId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify campaign belongs to user
    const campaign = await sql`
      SELECT * FROM campaigns 
      WHERE id = ${campaignId} AND account_id = ${accountId}
    `

    if (campaign.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if contact already exists in company_contacts
    let contact = await sql`
      SELECT * FROM company_contacts
      WHERE company_id = ${companyId} AND email = ${email}
    `

    if (contact.length === 0) {
      // Create the contact if it doesn't exist
      console.log("[v0] Creating new contact for company", companyId)
      const newContact = await sql`
        INSERT INTO company_contacts (
          company_id,
          name,
          email,
          position,
          department,
          linkedin,
          twitter,
          source,
          email_verification_status
        )
        VALUES (
          ${companyId},
          ${`${firstName} ${lastName}`},
          ${email},
          ${position || null},
          ${department || null},
          ${linkedin || null},
          ${twitter || null},
          ${source || "hunter.io"},
          'valid'
        )
        RETURNING *
      `
      contact = newContact
    } else {
      console.log("[v0] Contact already exists, using existing contact")
    }

    const contactId = contact[0].id

    // Check if already linked to campaign
    const existing = await sql`
      SELECT * FROM campaign_contacts
      WHERE campaign_id = ${campaignId} AND contact_id = ${contactId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Contact already added to this campaign" }, { status: 400 })
    }

    // Link contact to campaign
    await sql`
      INSERT INTO campaign_contacts (campaign_id, contact_id)
      VALUES (${campaignId}, ${contactId})
    `

    console.log("[v0] Successfully linked contact to campaign")

    return NextResponse.json({
      success: true,
      message: "Contact added to campaign",
      contactId,
    })
  } catch (error: any) {
    console.error("[v0] Error adding contact to campaign:", error)
    return NextResponse.json({ error: error.message || "Failed to add contact to campaign" }, { status: 500 })
  }
}
