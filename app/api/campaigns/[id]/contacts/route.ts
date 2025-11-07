import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.NEON_DATABASE_URL!)

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const campaignId = Number.parseInt(id)
    const { contactIds } = await request.json()

    if (!contactIds || !Array.isArray(contactIds)) {
      return Response.json({ error: "Contact IDs are required" }, { status: 400 })
    }

    // Remove contacts from campaign
    await sql`
      DELETE FROM campaign_contacts
      WHERE campaign_id = ${campaignId}
      AND contact_id = ANY(${contactIds})
    `

    return Response.json({ success: true })
  } catch (error) {
    console.error("Error removing contacts from campaign:", error)
    return Response.json({ error: "Failed to remove contacts from campaign" }, { status: 500 })
  }
}
