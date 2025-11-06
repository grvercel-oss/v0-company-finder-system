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

    console.log(`[v0] [VERIFY] Starting verification for ${contactIds.length} contact IDs`)

    // Fetch contacts with pending status
    const contacts = await sql`
      SELECT id, email, email_verification_status
      FROM company_contacts 
      WHERE id = ANY(${contactIds})
      AND (email_verification_status = 'pending' OR email_verification_status IS NULL)
    `

    console.log(`[v0] [VERIFY] Found ${contacts.length} contacts to verify`)

    if (contacts.length === 0) {
      console.log(`[v0] [VERIFY] No pending contacts found`)
      return NextResponse.json({
        success: true,
        results: [],
        message: "No pending contacts to verify",
      })
    }

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

    const summary = {
      verified: verificationResults.filter((r) => r.status === "verified").length,
      unverified: verificationResults.filter((r) => r.status === "unverified").length,
      invalid: verificationResults.filter((r) => r.status === "invalid").length,
    }

    console.log(
      `[v0] [VERIFY] Complete - Verified: ${summary.verified}, Unverified: ${summary.unverified}, Invalid: ${summary.invalid}`,
    )

    return NextResponse.json({
      success: true,
      results: verificationResults,
      summary,
    })
  } catch (error) {
    console.error("[v0] [VERIFY] Error:", error)
    return NextResponse.json({ error: "Failed to verify emails" }, { status: 500 })
  }
}
