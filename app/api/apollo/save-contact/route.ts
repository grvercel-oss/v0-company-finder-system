import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const {
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

    console.log("[v0] Apollo save contact:", { companyId, email, firstName, lastName })

    if (!companyId || !email || !firstName || !lastName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

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
        ${position || "Executive"},
        ${email},
        ${linkedin || null},
        ${"apollo.io"},
        ${emailStatus === "verified" ? 0.95 : emailStatus === "guessed" ? 0.7 : 0.5},
        ${emailStatus === "verified"},
        ${emailStatus || "valid"}
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
      RETURNING *
    `

    console.log("[v0] Contact saved successfully:", email)

    return NextResponse.json({
      success: true,
      email,
      name: `${firstName} ${lastName}`,
      position,
    })
  } catch (error: any) {
    console.error("[Apollo Save] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to save contact" }, { status: 500 })
  }
}
