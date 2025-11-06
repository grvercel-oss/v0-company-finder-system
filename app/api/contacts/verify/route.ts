import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyEmail } from "@/lib/email-verifier"
import { auth } from "@clerk/nextjs/server"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { contactIds } = await request.json()

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: "Invalid contact IDs" }, { status: 400 })
    }

    console.log(`[v0] [VERIFY] Starting verification for ${contactIds.length} contacts`)

    // First, check if contacts exist at all
    const allContacts = await sql`
      SELECT id, email, email_verification_status, company_id
      FROM company_contacts 
      WHERE id = ANY(${contactIds})
    `
    console.log(`[v0] [VERIFY] Total contacts found in DB: ${allContacts.length}`)
    console.log(
      `[v0] [VERIFY] Contact statuses:`,
      allContacts.map((c) => ({ id: c.id, email: c.email, status: c.email_verification_status })),
    )

    // Fetch contacts with pending status
    const contacts = await sql`
      SELECT id, email 
      FROM company_contacts 
      WHERE id = ANY(${contactIds})
      AND email_verification_status = 'pending'
    `

    console.log(`[v0] [VERIFY] Found ${contacts.length} contacts with 'pending' status to verify`)

    if (contacts.length === 0) {
      console.log(`[v0] [VERIFY] No pending contacts to verify. All contacts might already be verified or invalid.`)
      return NextResponse.json({
        success: true,
        results: [],
        message: "No pending contacts to verify",
      })
    }

    // Verify each email
    const verificationResults = []
    for (const contact of contacts) {
      console.log(`[v0] [VERIFY] Verifying email: ${contact.email}`)
      const result = await verifyEmail(contact.email)
      console.log(`[v0] [VERIFY] Result for ${contact.email}: ${result.status} (${result.reason})`)

      // Update database
      await sql`
        UPDATE company_contacts 
        SET email_verification_status = ${result.status}
        WHERE id = ${contact.id}
      `

      verificationResults.push({
        contactId: contact.id,
        email: contact.email,
        status: result.status,
        reason: result.reason,
      })
    }

    console.log(`[v0] [VERIFY] Verification complete. Summary:`)
    console.log(`[v0] [VERIFY] - Verified: ${verificationResults.filter((r) => r.status === "verified").length}`)
    console.log(`[v0] [VERIFY] - Unverified: ${verificationResults.filter((r) => r.status === "unverified").length}`)
    console.log(`[v0] [VERIFY] - Invalid: ${verificationResults.filter((r) => r.status === "invalid").length}`)

    return NextResponse.json({
      success: true,
      results: verificationResults,
    })
  } catch (error) {
    console.error("[v0] [VERIFY] Email verification error:", error)
    return NextResponse.json({ error: "Failed to verify emails" }, { status: 500 })
  }
}
