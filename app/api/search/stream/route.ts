// SSE Streaming endpoint for real-time search results

import type { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { extractICP, generateSearchQueries } from "@/lib/search-workers/icp-extractor"
import { PerplexityWorker } from "@/lib/search-workers/perplexity-worker"
import { mergeAndSaveCompany, linkSearchResult } from "@/lib/search-workers/merger"

export async function GET(request: NextRequest) {
  const accountId = await getAccountIdFromRequest(request)
  if (!accountId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("query")
  const desiredCount = Number.parseInt(searchParams.get("desired_count") || "20")

  if (!query) {
    return new Response("Query required", { status: 400 })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send("status", { message: "Extracting ICP..." })

        // Extract ICP
        const icp = await extractICP(query)
        send("icp", { icp })

        // Create search request
        const searchRequest = await sql`
          INSERT INTO search_requests (account_id, raw_query, icp, desired_count, status)
          VALUES (${accountId}, ${query}, ${JSON.stringify(icp)}, ${desiredCount}, 'processing')
          RETURNING *
        `
        const searchId = searchRequest[0].id

        send("search_started", { search_id: searchId })

        // Generate queries
        send("status", { message: "Generating search queries..." })
        const searchQueries = await generateSearchQueries(query, icp)

        // Run workers
        send("status", { message: "Searching multiple sources..." })
        const workers = [new PerplexityWorker()]

        const workerPromises = workers.map(async (worker) => {
          send("worker_started", { worker: worker.name })

          try {
            const result = await Promise.race([
              worker.search(searchQueries, icp),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), worker.timeout)),
            ])

            send("worker_completed", { worker: worker.name, count: (result as any).companies.length })

            // Process companies from this worker
            for (const companyResult of (result as any).companies) {
              try {
                const merged = await mergeAndSaveCompany(companyResult, accountId)
                await linkSearchResult(searchId, merged.company_id, worker.name, companyResult.confidence_score || 0)

                // Stream new company to client
                send("new_company", {
                  company: merged.company,
                  is_new: merged.is_new,
                  source: worker.name,
                })
              } catch (error: any) {
                console.error("[v0] Error merging company:", error.message)
              }
            }
          } catch (error: any) {
            send("worker_error", { worker: worker.name, error: error.message })
          }
        })

        await Promise.allSettled(workerPromises)

        // Mark search as completed
        await sql`
          UPDATE search_requests 
          SET status = 'completed', completed_at = now()
          WHERE id = ${searchId}
        `

        send("search_completed", { search_id: searchId })
        controller.close()
      } catch (error: any) {
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
