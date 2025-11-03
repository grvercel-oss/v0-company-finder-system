import { sql } from "@/lib/db"
import { cookies } from "next/headers"

const DEFAULT_ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"

/**
 * Get the current account ID from the request
 * Returns DEFAULT_ACCOUNT_ID if no account is found (single-user mode)
 */
export async function getAccountIdFromRequest(request: Request): Promise<string> {
  console.log("[v0] [RLS] Getting account ID from request...")

  try {
    // 1. Check for account_id in header (for API calls)
    try {
      const headerAccountId = request.headers.get("x-account-id")
      console.log("[v0] [RLS] Header account_id:", headerAccountId ? "found" : "not found")
      if (headerAccountId) {
        console.log("[v0] [RLS] Using account_id from header:", headerAccountId)
        return headerAccountId
      }
    } catch (error) {
      console.error("[v0] [RLS] Error reading header:", error)
    }

    // 2. Check for account_id in cookie (for browser requests)
    try {
      const cookieStore = await cookies()
      const cookieAccountId = cookieStore.get("account_id")?.value
      console.log("[v0] [RLS] Cookie account_id:", cookieAccountId ? "found" : "not found")
      if (cookieAccountId) {
        console.log("[v0] [RLS] Using account_id from cookie:", cookieAccountId)
        return cookieAccountId
      }
    } catch (error) {
      console.error("[v0] [RLS] Error reading cookie:", error)
    }

    // 3. Fallback: Get from database (check if any config exists)
    if (process.env.NEON_NEON_NEON_NEON_DATABASE_URL) {
      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Database query timeout")), 3000),
        )

        const queryPromise = sql`
          SELECT account_id 
          FROM account_email_provider 
          WHERE account_id IS NOT NULL
          LIMIT 1
        `

        const result = await Promise.race([queryPromise, timeoutPromise])
        console.log(
          "[v0] [RLS] Database query result:",
          result ? `${Array.isArray(result) ? result.length : 0} rows` : "null",
        )

        if (result && Array.isArray(result) && result.length > 0 && result[0]?.account_id) {
          console.log("[v0] [RLS] Found account_id in database:", result[0].account_id)
          return result[0].account_id
        }
      } catch (error) {
        // Ignore errors and fall through to default
        console.error("[v0] [RLS] Error querying database:", error instanceof Error ? error.message : error)
      }
    }

    console.log("[v0] [RLS] No account_id found from any source, using default:", DEFAULT_ACCOUNT_ID)
    return DEFAULT_ACCOUNT_ID
  } catch (error) {
    console.error("[v0] [RLS] Error getting account ID from request:", error)
    console.log("[v0] [RLS] Returning default account ID due to error:", DEFAULT_ACCOUNT_ID)
    return DEFAULT_ACCOUNT_ID
  }
}

/**
 * Execute queries with account context (serverless-compatible)
 * Note: In serverless environments, we can't rely on session variables
 * So this is a simplified version that just executes the query
 */
export async function withRLS<T>(accountId: string, queryFn: () => Promise<T>): Promise<T> {
  // In serverless, we can't use SET LOCAL reliably
  // The queries themselves should filter by account_id
  // This function is kept for API compatibility
  return await queryFn()
}

/**
 * Bypass RLS for admin/cron operations
 * In serverless mode, this is a no-op since we don't use session variables
 */
export async function bypassRLS(): Promise<void> {
  // No-op in serverless mode
  // Cron jobs should query without account_id filters when needed
}

/**
 * Execute a query with account_id filtering
 * In serverless environments, we filter by account_id directly in queries
 * rather than using session variables which don't persist across connections
 */
export async function withAccountId<T>(accountId: string, queryFn: (accountId: string) => Promise<T>): Promise<T> {
  // Simply pass the account_id to the query function
  // The query function should include WHERE account_id = ${accountId}
  return await queryFn(accountId)
}

/**
 * Validate and require account ID from request
 * Always returns a valid account_id (never throws in single-user mode)
 */
export async function requireAccountId(request: Request): Promise<string> {
  return await getAccountIdFromRequest(request)
}

/**
 * Helper to add account_id filter to WHERE clauses
 * Usage: sql`SELECT * FROM table WHERE ${accountFilter(accountId)} AND other_condition`
 */
export function accountFilter(accountId: string) {
  return sql`account_id = ${accountId}`
}

/**
 * Get the current account ID from the request
 * Alias for getAccountIdFromRequest for simpler imports
 */
export async function getAccountId(request: Request): Promise<string> {
  return getAccountIdFromRequest(request)
}

/**
 * Get the default account ID constant
 */
export function getDefaultAccountId(): string {
  return DEFAULT_ACCOUNT_ID
}
