import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import {
  generateVerificationToken,
  getVerificationTokenExpiry,
  sendVerificationReminderEmail,
} from "@/lib/email-verification"

const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

export async function POST(request: NextRequest) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    // Get user info
    const result = await sql`
      SELECT email, email_verified
      FROM accounts
      WHERE id = ${accountId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user = result[0]

    if (user.email_verified) {
      return NextResponse.json({ error: "Email already verified" }, { status: 400 })
    }

    // Generate new token
    const verificationToken = generateVerificationToken()
    const verificationTokenExpires = getVerificationTokenExpiry()

    // Update token
    await sql`
      UPDATE accounts
      SET verification_token = ${verificationToken},
          verification_token_expires = ${verificationTokenExpires}
      WHERE id = ${accountId}
    `

    // Send email
    await sendVerificationReminderEmail(user.email, verificationToken)

    return NextResponse.json({
      success: true,
      message: "Verification email sent! Please check your email.",
    })
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json({ error: "Failed to resend verification email" }, { status: 500 })
  }
}
