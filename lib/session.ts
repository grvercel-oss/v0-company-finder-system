import { cookies } from "next/headers"

const SESSION_COOKIE_NAME = "account_session"
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

export interface SessionData {
  accountId: string
  email: string
  fullName: string
}

/**
 * Set session cookie
 */
export async function setSession(data: SessionData) {
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  })
}

/**
 * Get session data from cookie
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

    if (!sessionCookie?.value) {
      return null
    }

    const data = JSON.parse(sessionCookie.value) as SessionData
    return data
  } catch (error) {
    console.error("[v0] Error parsing session:", error)
    return null
  }
}

/**
 * Clear session cookie
 */
export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}
