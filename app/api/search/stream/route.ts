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
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const eventBatch: Array<{ event: string; data: any }> = []
      const flushEvents = () => {
        if (eventBatch.length > 0) {
          for (const { event, data } of eventBatch) {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
          }
          eventBatch.length = 0
        }
      }

      const batchSend = (event: string, data: any) => {
        eventBatch.push({ event, data })
        if (eventBatch.length >= 5) {
          flushEvents()
        }
      }

      try {
        send("status", { message: "Starting search..." })

        const cacheKey = query.toLowerCase().trim().replace(/\s+/g, "-")

        const [cachedCompanyIds, searchRequest] = await Promise.all([
          getCachedSearchResults(cacheKey),
          sql`
            INSERT INTO search_requests (account_id, raw_query, desired_count, status)
            VALUES (${accountId}, ${query}, ${desiredCount}, 'processing')
            RETURNING *
          `,
        ])

        const searchId = searchRequest[0].id
        console.log("[v0] Search request created:", searchId)

        if (cachedCompanyIds && cachedCompanyIds.length > 0) {
          console.log("[v0] Found cached results:", cachedCompanyIds.length, "companies")
          send("status", { message: "Loading cached results..." })

          const cachedCompanies = await sql`
            SELECT * FROM companies WHERE id = ANY(${cachedCompanyIds})
          `

          for (const company of cachedCompanies) {
            batchSend("new_company", { company, is_new: false, source: "cache" })
          }
          flushEvents()

          send("status", { message: "Cached results loaded. Searching for new companies..." })
        }

        send("search_started", { search_id: searchId })

        const workers = [
          new LinkedInSearchWorker(),
          new RedditSearchWorker(),
          new ClutchSearchWorker(),
          new ProductHuntSearchWorker(),
          new CrunchbaseSearchWorker(),
        ]

        const foundCompanyIds: number[] = []
        let totalCompaniesFound = 0
        let totalCost = 0
        let totalInputTokens = 0
        let totalOutputTokens = 0

        const abortController = new AbortController()
        const { signal } = abortController

        let searchRound = 0
        const maxSearchRounds = 5

        const pendingMerges: Array<{ companyResult: any; workerName: string }> = []
        const processBatch = async () => {
          if (pendingMerges.length === 0) return

          const batch = pendingMerges.splice(0, pendingMerges.length)
          console.log(`[v0] Processing batch of ${batch.length} companies`)

          // Process all merges in parallel
          const mergeResults = await Promise.allSettled(
            batch.map(async ({ companyResult, workerName }) => {
              try {
                const merged = await mergeAndSaveCompany(companyResult, accountId)
                await linkSearchResult(searchId, merged.company_id, workerName, companyResult.confidence_score || 0)

                foundCompanyIds.push(merged.company_id)
                totalCompaniesFound++

                if (companyResult.tokenUsage) {
                  totalInputTokens += companyResult.tokenUsage.prompt_tokens
                  totalOutputTokens += companyResult.tokenUsage.completion_tokens
                  totalCost += companyResult.tokenUsage.cost
                }

                return { merged, companyResult, workerName }
              } catch (error: any) {
                console.error("[v0] Error merging company:", error.message)
                return null
              }
            }),
          )

          // Stream all successful results
          for (const result of mergeResults) {
            if (result.status === "fulfilled" && result.value) {
              const { merged, companyResult, workerName } = result.value

              batchSend("new_company", {
                company: merged.company,
                is_new: merged.is_new,
                source: workerName,
              })

              if (companyResult.tokenUsage) {
                batchSend("cost_update", {
                  total_cost: totalCost,
                  formatted_total: formatCost(totalCost),
                  companies_found: totalCompaniesFound,
                })
              }

              batchSend("progress", {
                total: totalCompaniesFound,
                target: desiredCount,
              })
            }
          }

          flushEvents()
        }

        while (totalCompaniesFound < desiredCount && searchRound < maxSearchRounds) {
          searchRound++
          const remainingNeeded = desiredCount - totalCompaniesFound
          const requestCount = Math.ceil(remainingNeeded * 2)

          send("status", {
            message:
              searchRound === 1
                ? "Searching multiple sources..."
                : `Round ${searchRound}: Searching for ${remainingNeeded} more companies...`,
          })

          const workerPromises = workers.map(async (worker) => {
            if (searchRound === 1) {
              send("worker_started", { worker: worker.name })
            }

            try {
              const searchGenerator = worker.searchProgressive(query, requestCount)

              for await (const batch of searchGenerator) {
                if (signal.aborted) break

                for (const companyResult of batch) {
                  if (signal.aborted) break
                  pendingMerges.push({ companyResult, workerName: worker.name })

                  // Process batch when it reaches optimal size
                  if (pendingMerges.length >= 10) {
                    await processBatch()
                  }

                  if (totalCompaniesFound >= desiredCount) {
                    abortController.abort()
                    break
                  }
                }

                if (signal.aborted) break
              }

              // Process remaining companies from this worker
              await processBatch()

              if (searchRound === 1) {
                send("worker_completed", { worker: worker.name, count: totalCompaniesFound })
              }
            } catch (error: any) {
              if (error.message === "Timeout") {
                send("worker_error", { worker: worker.name, error: "Timeout after 150 seconds" })
              } else {
                send("worker_error", { worker: worker.name, error: error.message })
              }
            }
          })

          await Promise.allSettled(workerPromises)

          // Process any remaining companies
          await processBatch()

          if (totalCompaniesFound >= desiredCount) {
            break
          }

          if (searchRound < maxSearchRounds) {
            console.log(
              `[v0] Only found ${totalCompaniesFound}/${desiredCount} companies. Starting round ${searchRound + 1}...`,
            )
          }
        }

        if (totalCompaniesFound < desiredCount) {
          send("status", {
            message: `Found ${totalCompaniesFound} companies (requested ${desiredCount}). No more results available.`,
          })
        }

        if (foundCompanyIds.length > 0) {
          await cacheSearchResults(cacheKey, foundCompanyIds)
        }

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
