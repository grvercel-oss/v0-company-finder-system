import { sql } from "@/lib/db"

/**
 * Sync Clerk user to local accounts table
 * This ensures we have a local record for RLS and relationships
 */
export async function syncClerkUser(userId: string, email: string, fullName: string) {
  try {
    console.log("[v0] [Clerk Sync] Syncing user:", userId, email)

    // Check if account exists
    const existing = await sql`
      SELECT id FROM accounts WHERE id = ${userId}
    `

    if (existing.length === 0) {
      // Create new account
      await sql`
        INSERT INTO accounts (id, email, full_name, created_at, updated_at)
        VALUES (${userId}, ${email}, ${fullName}, NOW(), NOW())
      `
      console.log("[v0] [Clerk Sync] Created new account for user:", userId)
    } else {
      // Update existing account
      await sql`
        UPDATE accounts 
        SET email = ${email}, 
            full_name = ${fullName}, 
            updated_at = NOW(),
            last_login_at = NOW()
        WHERE id = ${userId}
      `
      console.log("[v0] [Clerk Sync] Updated existing account for user:", userId)
    }

    return true
  } catch (error) {
    console.error("[v0] [Clerk Sync] Error syncing user:", error)
    return false
  }
}
