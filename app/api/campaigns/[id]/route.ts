import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET single campaign with contacts
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const campaigns = await sql`
      SELECT * FROM campaigns 
      WHERE id = ${id} 
        AND deleted_at IS NULL
    `

    if (campaigns.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const contacts = await sql`
      SELECT 
        cc.id,
        cc.email,
        cc.name,
        cc.role as job_title,
        cc.linkedin_url,
        cc.phone,
        cc.source,
        cc.confidence_score as hunter_confidence,
        cc.email_verification_status,
        c.id as company_id,
        c.name as company_name,
        c.description as company_description,
        c.website as company_website,
        c.industry as company_industry,
        c.size as company_size,
        camp_cont.added_at
      FROM campaign_contacts camp_cont
      JOIN company_contacts cc ON camp_cont.contact_id = cc.id
      JOIN companies c ON cc.company_id = c.id
      WHERE camp_cont.campaign_id = ${id}
      ORDER BY camp_cont.added_at DESC
    `

    return NextResponse.json({
      campaign: campaigns[0],
      contacts,
    })
  } catch (error) {
    console.error("Error fetching campaign:", error)
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 })
  }
}

// PATCH update campaign
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, status } = body

    const result = await sql`
      UPDATE campaigns
      SET 
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        status = COALESCE(${status}, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    return NextResponse.json({ campaign: result[0] })
  } catch (error) {
    console.error("Error updating campaign:", error)
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 })
  }
}

// DELETE campaign
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const result = await sql`
      UPDATE campaigns 
      SET deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
        AND deleted_at IS NULL
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Campaign not found or already deleted" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting campaign:", error)
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 })
  }
}
