import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function POST(req: Request) {
  try {
    const accountId = await getAccountIdFromRequest(req)

    const {
      campaignId,
      companyId,
      email,
      firstName,
      lastName,
      position,
      department,
      linkedin,
      twitter,
      photoUrl,
      emailStatus,
      apolloId,
    } = await req.json()

    console.log("[v0] Adding Apollo contact to campaign", { campaignId, email })

    if (!campaignId || !companyId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const campaign = await sql`
      SELECT * FROM campaigns 
      WHERE id = ${campaignId} AND account_id = ${accountId}
    `

    if (campaign.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    let contact = await sql`
      SELECT * FROM company_contacts
      WHERE company_id = ${companyId} AND email = ${email}
    `

    if (contact.length === 0) {
      console.log("[v0] Creating new contact for company", companyId)
      const newContact = await sql`
        INSERT INTO company_contacts (
          company_id,
          name,
          email,
          role,
          department,
          linkedin_url,
          source,
          confidence_score,
          verified,
          email_verification_status
        )
        VALUES (
          ${companyId},
          ${`${firstName} ${lastName}`},
          ${email},
          ${position || "Executive"},
          ${department || null},
          ${linkedin || null},
          ${"apollo.io"},
          ${emailStatus === "verified" ? 0.95 : emailStatus === "guessed" ? 0.7 : 0.5},
          ${emailStatus === "verified"},
          ${emailStatus || "valid"}
        )
        RETURNING *
      `
      contact = newContact
    } else {
      console.log("[v0] Contact already exists")
    }

    const contactId = contact[0].id

    const existing = await sql`
      SELECT * FROM campaign_contacts
      WHERE campaign_id = ${campaignId} AND contact_id = ${contactId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Contact already in campaign" }, { status: 400 })
    }

    await sql`
      INSERT INTO campaign_contacts (campaign_id, contact_id)
      VALUES (${campaignId}, ${contactId})
    `

    console.log("[v0] Successfully added contact to campaign")

    return NextResponse.json({ success: true, contactId })
  } catch (error: any) {
    console.error("[Apollo Add Campaign] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to add to campaign" }, { status: 500 })
  }
}
