import { sql } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"

const DEFAULT_ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"

/**
 * Get the current account ID from Clerk authentication
 * Returns the Clerk user ID as the account_id
 */
export async function getAccountIdFromRequest(request?: Request): Promise<string> {
  console.log("[v0] [RLS] Getting account ID from Clerk...")

  try {
    const { userId } = await auth()

    if (userId) {
      console.log("[v0] [RLS] Using Clerk user ID as account_id:", userId)
      return userId
    }

    console.log("[v0] [RLS] No Clerk user found, using default:", DEFAULT_ACCOUNT_ID)
    return DEFAULT_ACCOUNT_ID
  } catch (error) {
    console.error("[v0] [RLS] Error getting account ID from Clerk:", error)
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
