import { type NextRequest, NextResponse } from "next/server"
import { revealEmail } from "@/lib/hunter"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { domain, firstName, lastName, companyId, companyName } = await request.json()

    if (!domain || !firstName || !lastName) {
      return NextResponse.json({ error: "Domain, firstName, and lastName are required" }, { status: 400 })
    }

    const result = await revealEmail(domain, firstName, lastName)

    if (companyId && result.email) {
      try {
        await sql`
          INSERT INTO company_contacts (
            company_id,
            name,
            role,
            email,
            linkedin_url,
            source,
            confidence_score,
            verified,
            email_verification_status
          ) VALUES (
            ${companyId},
            ${`${firstName} ${lastName}`},
            ${result.position || "Executive"},
            ${result.email},
            ${result.linkedin_url || null},
            ${"hunter.io"},
            ${result.score ? result.score / 100 : 0.85},
            ${result.verification?.status === "valid"},
            ${result.verification?.status || "valid"}
          )
          ON CONFLICT (company_id, email) 
          DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            linkedin_url = EXCLUDED.linkedin_url,
            confidence_score = EXCLUDED.confidence_score,
            verified = EXCLUDED.verified,
            email_verification_status = EXCLUDED.email_verification_status,
            updated_at = CURRENT_TIMESTAMP
        `

        console.log(`[Hunter.io] Saved contact ${result.email} for company ${companyId}`)
      } catch (dbError) {
        console.error("[Hunter.io] Failed to save contact to database:", dbError)
        // Don't fail the request if database save fails
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Hunter.io Reveal] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to reveal email" }, { status: 500 })
  }
}
