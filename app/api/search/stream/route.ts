// SSE Streaming endpoint for real-time search results

import type { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { extractICP, generateSearchQueries } from "@/lib/search-workers/icp-extractor"
import { PerplexityWorker } from "@/lib/search-workers/perplexity-worker"
import { mergeAndSaveCompany, linkSearchResult } from "@/lib/search-workers/merger"
import {
  checkRateLimit,
  generateICPHash,
  getCachedSearchResults,
  cacheSearchResults,
  fastInitialLookup,
} from "@/lib/search-cache"

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

  console.log("[v0] Starting search for query:", query)

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        console.log("[v0] Sending event:", event, data)
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send("status", { message: "Extracting ICP..." })

        // Extract ICP
        console.log("[v0] Extracting ICP...")
        const icp = await extractICP(query)
        console.log("[v0] ICP extracted:", icp)
        send("icp", { icp })

        const icpHash = generateICPHash(icp)
        console.log("[v0] ICP hash:", icpHash)

        const cachedCompanyIds = await getCachedSearchResults(icpHash)
        if (cachedCompanyIds && cachedCompanyIds.length > 0) {
          console.log("[v0] Found cached results:", cachedCompanyIds.length, "companies")
          send("status", { message: "Loading cached results..." })

          // Fetch cached companies
          const cachedCompanies = await sql`
            SELECT * FROM companies WHERE id = ANY(${cachedCompanyIds})
          `

          for (const company of cachedCompanies) {
            send("new_company", { company, is_new: false, source: "cache" })
          }

          send("status", { message: "Cached results loaded. Searching for new companies..." })
        }

        send("status", { message: "Searching existing companies..." })
        const fastResults = await fastInitialLookup(icp, accountId, 20)
        console.log("[v0] Fast lookup found", fastResults.length, "companies")

        if (fastResults.length > 0) {
          for (const company of fastResults) {
            send("new_company", { company, is_new: false, source: "database" })
          }
        }

        // Create search request
        console.log("[v0] Creating search request...")
        const searchRequest = await sql`
          INSERT INTO search_requests (account_id, raw_query, icp, desired_count, status)
          VALUES (${accountId}, ${query}, ${JSON.stringify(icp)}, ${desiredCount}, 'processing')
          RETURNING *
        `
        const searchId = searchRequest[0].id
        console.log("[v0] Search request created:", searchId)

        send("search_started", { search_id: searchId })

        // Generate queries
        send("status", { message: "Generating search queries..." })
        console.log("[v0] Generating search queries...")
        const searchQueries = await generateSearchQueries(query, icp)
        console.log("[v0] Generated queries:", searchQueries)

        // Run workers
        send("status", { message: "Searching multiple sources..." })
        const workers = [new PerplexityWorker()]
        console.log(
          "[v0] Starting workers:",
          workers.map((w) => w.name),
        )

        const foundCompanyIds: number[] = []

        const workerPromises = workers.map(async (worker) => {
          send("worker_started", { worker: worker.name })
          console.log("[v0] Worker started:", worker.name)

          try {
            const result = await Promise.race([
              worker.search(searchQueries, icp),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), worker.timeout)),
            ])

            console.log("[v0] Worker", worker.name, "found", (result as any).companies.length, "companies")
            send("worker_completed", { worker: worker.name, count: (result as any).companies.length })

            // Process companies from this worker
            for (const companyResult of (result as any).companies) {
              try {
                const merged = await mergeAndSaveCompany(companyResult, accountId)
                await linkSearchResult(searchId, merged.company_id, worker.name, companyResult.confidence_score || 0)

                foundCompanyIds.push(merged.company_id)

                // Stream new company to client
                send("new_company", {
                  company: merged.company,
                  is_new: merged.is_new,
                  source: worker.name,
                })
                console.log("[v0] Streamed company:", merged.company.name)
              } catch (error: any) {
                console.error("[v0] Error merging company:", error.message)
              }
            }
          } catch (error: any) {
            console.error("[v0] Worker error:", worker.name, error.message)
            send("worker_error", { worker: worker.name, error: error.message })
          }
        })

        await Promise.allSettled(workerPromises)

        if (foundCompanyIds.length > 0) {
          await cacheSearchResults(icpHash, foundCompanyIds)
          console.log("[v0] Cached", foundCompanyIds.length, "company IDs")
        }

        // Mark search as completed
        console.log("[v0] Marking search as completed...")
        await sql`
          UPDATE search_requests 
          SET status = 'completed', completed_at = now()
          WHERE id = ${searchId}
        `

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
