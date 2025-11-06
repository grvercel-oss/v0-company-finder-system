// SSE Streaming endpoint for real-time search results

import type { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { checkRateLimit, getCachedSearchResults, cacheSearchResults } from "@/lib/search-cache"
import { formatCost } from "@/lib/cost-calculator"
import { MultiSourceWorker } from "@/lib/search-workers/multi-source-worker"

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
            send("new_company", { company, is_new: false, source: "cache" })
          }

          send("status", { message: "Cached results loaded. Searching for new companies..." })
        }

        send("search_started", { search_id: searchId })

        send("status", { message: "Searching across all sources..." })
        const worker = new MultiSourceWorker(query, "comprehensive search", 0)

        const foundCompanyIds: number[] = []
        const foundDomains = new Set<string>()
        let totalCompaniesFound = 0
        let totalCost = 0
        let totalInputTokens = 0
        let totalOutputTokens = 0

        const abortController = new AbortController()
        const { signal } = abortController

        send("worker_started", { worker: worker.name })

        try {
          const searchGenerator = worker.searchProgressive(signal, foundDomains)

          for await (const batch of searchGenerator) {
            if (signal.aborted) break

            const company = batch[0] // Get the single company from the batch

            try {
              const domain = company.domain || company.name

              if (foundDomains.has(domain)) {
                console.log(`[v0] Stream route: Already processed ${domain}, skipping`)
                continue
              }

              console.log(`[v0] Saving company: ${company.name} (${domain})`)

              const inserted = await sql`
                INSERT INTO companies (
                  name, domain, description, industry, location, website,
                  employee_count, revenue_range, funding_stage,
                  technologies, sources, data_quality_score
                ) VALUES (
                  ${company.name},
                  ${domain},
                  ${company.description || null},
                  ${company.industry || null},
                  ${company.location || null},
                  ${company.website || null},
                  ${company.employee_count || null},
                  ${company.revenue_range || null},
                  ${company.funding_stage || null},
                  ${company.technologies || []},
                  ${JSON.stringify([company.source])},
                  ${company.confidence_score ? Math.round(company.confidence_score * 100) : 50}
                )
                ON CONFLICT (domain) DO UPDATE SET
                  name = EXCLUDED.name,
                  description = COALESCE(EXCLUDED.description, companies.description),
                  industry = COALESCE(EXCLUDED.industry, companies.industry),
                  location = COALESCE(EXCLUDED.location, companies.location),
                  website = COALESCE(EXCLUDED.website, companies.website),
                  employee_count = COALESCE(EXCLUDED.employee_count, companies.employee_count),
                  last_updated = now()
                RETURNING *
              `
              const savedCompany = inserted[0]

              foundDomains.add(domain)

              // Link search result
              await sql`
                INSERT INTO search_results (search_id, company_id, source, score)
                VALUES (${searchId}, ${savedCompany.id}, ${worker.name}, ${company.confidence_score || 0})
                ON CONFLICT (search_id, company_id) DO NOTHING
              `

              foundCompanyIds.push(savedCompany.id)
              totalCompaniesFound++

              if (company.tokenUsage) {
                totalInputTokens += company.tokenUsage.prompt_tokens
                totalOutputTokens += company.tokenUsage.completion_tokens
                totalCost += company.tokenUsage.cost
              }

              send("new_company", {
                company: savedCompany,
                is_new: true,
                source: worker.name,
              })

              if (company.tokenUsage) {
                send("cost_update", {
                  total_cost: totalCost,
                  formatted_total: formatCost(totalCost),
                  companies_found: totalCompaniesFound,
                })
              }

              send("progress", {
                total: totalCompaniesFound,
                target: desiredCount,
              })

              if (totalCompaniesFound >= desiredCount) {
                console.log(`[v0] Reached desired count of ${desiredCount} unique companies, stopping search`)
                abortController.abort()
                break
              }
            } catch (error: any) {
              console.error("[v0] Error saving company:", error.message)
            }

            if (signal.aborted) break
          }

          send("worker_completed", { worker: worker.name, count: totalCompaniesFound })
        } catch (error: any) {
          if (error.message === "Timeout") {
            send("worker_error", { worker: worker.name, error: "Timeout after 150 seconds" })
          } else {
            send("worker_error", { worker: worker.name, error: error.message })
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
