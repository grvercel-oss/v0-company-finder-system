import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { verifyPassword, validateEmail } from "@/lib/auth"
import { setSession } from "@/lib/session"

const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

// Rate limiting map (in production, use Redis)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const attempts = loginAttempts.get(email)

  if (!attempts || now > attempts.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 }) // 15 minutes
    return true
  }

  if (attempts.count >= 5) {
    return false
  }

  attempts.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Check rate limit
    if (!checkRateLimit(email.toLowerCase())) {
      return NextResponse.json({ error: "Too many login attempts. Please try again in 15 minutes." }, { status: 429 })
    }

    // Find account
    const accounts = await sql`
      SELECT id, email, password_hash, full_name
      FROM accounts
      WHERE email = ${email.toLowerCase()}
    `

    if (accounts.length === 0) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const account = accounts[0]

    // Verify password
    const isValid = await verifyPassword(password, account.password_hash)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Update last login
    await sql`
      UPDATE accounts
      SET last_login_at = NOW()
      WHERE id = ${account.id}
    `

    console.log("[v0] User logged in:", account.id, account.email)

    // Set session
    await setSession({
      accountId: account.id,
      email: account.email,
      fullName: account.full_name,
    })

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        fullName: account.full_name,
      },
    })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}
