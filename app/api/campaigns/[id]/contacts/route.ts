import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.NEON_DATABASE_URL!)

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const campaignId = Number.parseInt(id)
    const { contactIds } = await request.json()

    console.log("[v0] Deleting contacts from campaign:", { campaignId, contactIds })

    if (!contactIds || !Array.isArray(contactIds)) {
      return Response.json({ error: "Contact IDs are required" }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM campaign_contacts
      WHERE campaign_id = ${campaignId}
      AND contact_id = ANY(${contactIds})
    `

    console.log("[v0] Removed contacts from campaign:", result)

    return Response.json({ success: true, removed: contactIds.length })
  } catch (error) {
    console.error("[v0] Error removing contacts from campaign:", error)
    return Response.json({ error: "Failed to remove contacts from campaign" }, { status: 500 })
  }
}
