import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { hashPassword, validatePassword, validateEmail, generateAccountId } from "@/lib/auth"
import { setSession } from "@/lib/session"

const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

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

    // Create account
    await sql`
      INSERT INTO accounts (id, email, password_hash, full_name, created_at, updated_at, last_login_at)
      VALUES (
        ${accountId},
        ${email.toLowerCase()},
        ${passwordHash},
        ${fullName},
        NOW(),
        NOW(),
        NOW()
      )
    `

    console.log("[v0] Account created:", accountId, email)

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
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Signup error:", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}
