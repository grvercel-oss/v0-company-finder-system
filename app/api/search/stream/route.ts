// SSE Streaming endpoint for real-time search results

import type { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { mergeAndSaveCompany, linkSearchResult } from "@/lib/search-workers/merger"
import { checkRateLimit, getCachedSearchResults, cacheSearchResults } from "@/lib/search-cache"
import { LinkedInSearchWorker } from "@/lib/search-workers/gpt-workers/linkedin-worker"
import { RedditSearchWorker } from "@/lib/search-workers/gpt-workers/reddit-worker"
import { ClutchSearchWorker } from "@/lib/search-workers/gpt-workers/clutch-worker"
import { ProductHuntSearchWorker } from "@/lib/search-workers/gpt-workers/producthunt-worker"
import { CrunchbaseSearchWorker } from "@/lib/search-workers/gpt-workers/crunchbase-worker"
import { formatCost } from "@/lib/cost-calculator"

export async function GET(request: NextRequest) {
  console.log("[v0] Stream endpoint called")

  const accountId = await getAccountIdFromRequest(request)
  if (!accountId) {
    console.error("[v0] No account ID found")
    return new Response("Unauthorized", { status: 401 })
  }

  console.log("[v0] Account ID:", accountId)

  const rateLimit = await checkRateLimit(accountId)
  if (!rateLimit.allowed) {
    console.error("[v0] Rate limit exceeded for account:", accountId)
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })
  }
  console.log("[v0] Rate limit check passed, remaining:", rateLimit.remaining)

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("query")
  const desiredCount = Number.parseInt(searchParams.get("desired_count") || "20")

  if (!query) {
    console.error("[v0] No query provided")
    return new Response("Query required", { status: 400 })
  }

  console.log("[v0] Starting search for query:", query, "with desired count:", desiredCount)

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        console.log("[v0] Sending event:", event, data)
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send("status", { message: "Starting search..." })

        const cacheKey = query.toLowerCase().trim().replace(/\s+/g, "-")
        console.log("[v0] Cache key:", cacheKey)

        const cachedCompanyIds = await getCachedSearchResults(cacheKey)
        if (cachedCompanyIds && cachedCompanyIds.length > 0) {
          console.log("[v0] Found cached results:", cachedCompanyIds.length, "companies")
          send("status", { message: "Loading cached results..." })

          const cachedCompanies = await sql`
            SELECT * FROM companies WHERE id = ANY(${cachedCompanyIds})
          `

          for (const company of cachedCompanies) {
            send("new_company", { company, is_new: false, source: "cache" })
          }

          send("status", { message: "Cached results loaded. Searching for new companies..." })
        }

        console.log("[v0] Creating search request...")
        const searchRequest = await sql`
          INSERT INTO search_requests (account_id, raw_query, desired_count, status)
          VALUES (${accountId}, ${query}, ${desiredCount}, 'processing')
          RETURNING *
        `
        const searchId = searchRequest[0].id
        console.log("[v0] Search request created:", searchId)

        send("search_started", { search_id: searchId })

        const workers = [
          new LinkedInSearchWorker(),
          new RedditSearchWorker(),
          new ClutchSearchWorker(),
          new ProductHuntSearchWorker(),
          new CrunchbaseSearchWorker(),
        ]
        console.log(
          "[v0] Starting workers:",
          workers.map((w) => w.name),
        )

        const foundCompanyIds: number[] = []
        let totalCompaniesFound = 0
        let totalCost = 0
        let totalInputTokens = 0
        let totalOutputTokens = 0

        const abortController = new AbortController()
        const { signal } = abortController

        const targetWithBuffer = Math.ceil(desiredCount * 1.3)
        console.log(`[v0] Target: ${desiredCount}, with buffer: ${targetWithBuffer}`)

        let searchRound = 0
        const maxSearchRounds = 3 // Maximum 3 rounds of searching

        while (totalCompaniesFound < desiredCount && searchRound < maxSearchRounds) {
          searchRound++
          const remainingNeeded = desiredCount - totalCompaniesFound
          console.log(`[v0] Search round ${searchRound}: Need ${remainingNeeded} more companies`)

          send("status", {
            message:
              searchRound === 1
                ? "Searching multiple sources..."
                : `Round ${searchRound}: Searching for ${remainingNeeded} more companies...`,
          })

          const workerPromises = workers.map(async (worker) => {
            if (searchRound === 1) {
              send("worker_started", { worker: worker.name })
              console.log("[v0] Worker started:", worker.name)
            }

            try {
              const searchGenerator = worker.searchProgressive(query, remainingNeeded)

              let batchCount = 0
              for await (const batch of searchGenerator) {
                if (signal.aborted) {
                  console.log(`[v0] Worker ${worker.name} stopped - target count reached`)
                  break
                }

                batchCount++
                console.log(`[v0] Worker ${worker.name} yielded batch ${batchCount} with ${batch.length} companies`)

                for (const companyResult of batch) {
                  if (signal.aborted) {
                    console.log(`[v0] Worker ${worker.name} stopped mid-batch - target count reached`)
                    break
                  }

                  try {
                    const merged = await mergeAndSaveCompany(companyResult, accountId)
                    await linkSearchResult(
                      searchId,
                      merged.company_id,
                      worker.name,
                      companyResult.confidence_score || 0,
                    )

                    foundCompanyIds.push(merged.company_id)
                    totalCompaniesFound++

                    if (companyResult.tokenUsage) {
                      totalInputTokens += companyResult.tokenUsage.prompt_tokens
                      totalOutputTokens += companyResult.tokenUsage.completion_tokens
                      totalCost += companyResult.tokenUsage.cost

                      console.log(
                        `[v0] Cost update: +$${companyResult.tokenUsage.cost.toFixed(4)} (Total: $${totalCost.toFixed(4)})`,
                      )

                      send("cost_update", {
                        total_cost: totalCost,
                        formatted_total: formatCost(totalCost),
                        companies_found: totalCompaniesFound,
                      })
                    }

                    send("new_company", {
                      company: merged.company,
                      is_new: merged.is_new,
                      source: worker.name,
                    })

                    send("progress", {
                      total: totalCompaniesFound,
                      target: desiredCount,
                    })

                    console.log(`[v0] Streamed company ${totalCompaniesFound}/${desiredCount}:`, merged.company.name)

                    if (totalCompaniesFound >= desiredCount) {
                      console.log(`[v0] Target count ${desiredCount} reached! Stopping all workers...`)
                      abortController.abort()
                      break
                    }
                  } catch (error: any) {
                    console.error("[v0] Error merging company:", error.message)
                  }
                }

                if (signal.aborted) break
              }

              console.log(`[v0] Worker ${worker.name} completed round ${searchRound} with ${batchCount} batches`)
              if (searchRound === 1) {
                send("worker_completed", { worker: worker.name, count: totalCompaniesFound })
              }
            } catch (error: any) {
              if (error.message === "Timeout") {
                console.error("[v0] Worker timeout:", worker.name)
                send("worker_error", { worker: worker.name, error: "Timeout after 150 seconds" })
              } else {
                console.error("[v0] Worker error:", worker.name, error.message)
                send("worker_error", { worker: worker.name, error: error.message })
              }
            }
          })

          await Promise.allSettled(workerPromises)

          // Check if we've reached the target
          if (totalCompaniesFound >= desiredCount) {
            console.log(`[v0] Target reached after round ${searchRound}`)
            break
          }

          // If we haven't reached the target and this isn't the last round, continue
          if (searchRound < maxSearchRounds) {
            console.log(
              `[v0] Only found ${totalCompaniesFound}/${desiredCount} companies. Starting round ${searchRound + 1}...`,
            )
          }
        }

        if (totalCompaniesFound < desiredCount) {
          console.log(
            `[v0] Search completed with ${totalCompaniesFound}/${desiredCount} companies after ${searchRound} rounds`,
          )
          send("status", {
            message: `Found ${totalCompaniesFound} companies (requested ${desiredCount}). No more results available.`,
          })
        }

        if (foundCompanyIds.length > 0) {
          await cacheSearchResults(cacheKey, foundCompanyIds)
          console.log("[v0] Cached", foundCompanyIds.length, "company IDs")
        }

        // Mark search as completed
        console.log("[v0] Marking search as completed...")
        await sql`
          UPDATE search_requests 
          SET status = 'completed', completed_at = now()
          WHERE id = ${searchId}
        `

        send("cost_summary", {
          total_cost: totalCost,
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          formatted_total: formatCost(totalCost),
          companies_found: totalCompaniesFound,
          cost_per_company: totalCompaniesFound > 0 ? formatCost(totalCost / totalCompaniesFound) : "$0.00",
        })

        send("search_completed", { search_id: searchId })
        console.log("[v0] Search completed successfully")
        controller.close()
      } catch (error: any) {
        console.error("[v0] Stream error:", error)
        send("error", { message: error.message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
