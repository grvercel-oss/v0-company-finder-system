import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Verification token is required" }, { status: 400 })
    }

    // Find user with this token
    const result = await sql`
      SELECT id, email, verification_token_expires, email_verified
      FROM accounts
      WHERE verification_token = ${token}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 })
    }

    const user = result[0]

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json({
        success: true,
        message: "Email already verified",
        alreadyVerified: true,
      })
    }

    // Check if token expired
    if (new Date() > new Date(user.verification_token_expires)) {
      return NextResponse.json({ error: "Verification token has expired. Please request a new one." }, { status: 400 })
    }

    // Verify the email
    await sql`
      UPDATE accounts
      SET email_verified = true,
          verification_token = NULL,
          verification_token_expires = NULL
      WHERE id = ${user.id}
    `

    return NextResponse.json({
      success: true,
      message: "Email verified successfully!",
    })
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 })
  }
}
