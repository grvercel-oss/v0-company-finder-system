import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { syncEmailsForAccount } from "@/lib/email-sync"
import { acquireCronLock, releaseCronLock } from "@/lib/redis"
import { bypassRLS } from "@/lib/rls-helper"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET || "dev-secret"

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log("[v0] Unauthorized cron request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Starting email sync cron job")

    const lockAcquired = await acquireCronLock("email-sync-cron", 120)

    if (!lockAcquired) {
      console.log("[v0] Another sync is already running, skipping")
      return NextResponse.json({
        message: "Sync already in progress",
        skipped: true,
      })
    }

    try {
      await bypassRLS()

      const accounts = await sql`
        SELECT 
          account_id,
          provider,
          settings
        FROM account_email_provider
        WHERE settings IS NOT NULL
      `

      console.log(`[v0] Found ${accounts.length} connected accounts`)

      if (accounts.length === 0) {
        return NextResponse.json({
          message: "No connected accounts",
          accounts: 0,
        })
      }

      const results = []
      for (const account of accounts) {
        try {
          const repliesDetected = await syncEmailsForAccount(account)
          results.push({
            accountId: account.account_id,
            success: true,
            repliesDetected,
          })
        } catch (error) {
          console.error(`[v0] Failed to sync account ${account.account_id}:`, error)
          results.push({
            accountId: account.account_id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }

      const duration = Date.now() - startTime
      const totalReplies = results.reduce((sum, r) => sum + (r.repliesDetected || 0), 0)

      console.log(`[v0] Email sync completed in ${duration}ms, detected ${totalReplies} replies`)

      return NextResponse.json({
        success: true,
        accounts: accounts.length,
        results,
        totalReplies,
        duration,
      })
    } finally {
      await releaseCronLock("email-sync-cron")
    }
  } catch (error) {
    console.error("[v0] Email sync cron error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
