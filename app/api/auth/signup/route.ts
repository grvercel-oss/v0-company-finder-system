import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { hashPassword, validatePassword, validateEmail, generateAccountId } from "@/lib/auth"
import { setSession } from "@/lib/session"
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from "@/lib/email-verification"

const sql = neon(process.env.NEON_NEON_NEON_DATABASE_URL!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, fullName } = body

    // Validate input
    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Email, password, and full name are required" }, { status: 400 })
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.errors.join(", ") }, { status: 400 })
    }

    // Check if email already exists
    const existingUser = await sql`
      SELECT id FROM accounts WHERE email = ${email.toLowerCase()}
    `

    if (existingUser.length > 0) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 })
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Generate account ID
    const accountId = generateAccountId()

    const verificationToken = generateVerificationToken()
    const verificationTokenExpires = getVerificationTokenExpiry()

    await sql`
      INSERT INTO accounts (
        id, email, password_hash, full_name, 
        verification_token, verification_token_expires, email_verified,
        created_at, updated_at, last_login_at
      )
      VALUES (
        ${accountId},
        ${email.toLowerCase()},
        ${passwordHash},
        ${fullName},
        ${verificationToken},
        ${verificationTokenExpires},
        false,
        NOW(),
        NOW(),
        NOW()
      )
    `

    console.log("[v0] Account created:", accountId, email)

    await sendVerificationEmail(email, verificationToken)

    // Set session
    await setSession({
      accountId,
      email: email.toLowerCase(),
      fullName,
    })

    return NextResponse.json(
      {
        success: true,
        account: {
          id: accountId,
          email: email.toLowerCase(),
          fullName,
          emailVerified: false,
        },
        message: "Account created! Please check your email (or console) to verify your account.",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Signup error:", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}
