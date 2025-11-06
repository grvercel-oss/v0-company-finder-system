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

    console.log(`[v0] Starting verification for ${contactIds.length} contacts`)

    // Fetch contacts
    const contacts = await sql`
      SELECT id, email 
      FROM company_contacts 
      WHERE id = ANY(${contactIds})
      AND email_verification_status = 'pending'
    `

    console.log(`[v0] Found ${contacts.length} contacts to verify`)

    // Verify each email
    const verificationResults = []
    for (const contact of contacts) {
      const result = await verifyEmail(contact.email)

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

    console.log(`[v0] Verification complete. Results:`, verificationResults)

    return NextResponse.json({
      success: true,
      results: verificationResults,
    })
  } catch (error) {
    console.error("[v0] Email verification error:", error)
    return NextResponse.json({ error: "Failed to verify emails" }, { status: 500 })
  }
}
