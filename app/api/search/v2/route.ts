// New V2 Search API - Multi-source with streaming support

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { extractICP, generateSearchQueries } from "@/lib/search-workers/icp-extractor"
import { PerplexityWorker } from "@/lib/search-workers/perplexity-worker"

export async function POST(request: NextRequest) {
  console.log("[v0] Search V2 API called")

  try {
    const accountId = await getAccountIdFromRequest(request)
    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { query, desired_count = 20 } = body

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    console.log("[v0] Starting V2 search for:", query)

    // Step 1: Extract ICP from raw query
    console.log("[v0] Step 1: Extracting ICP...")
    const icp = await extractICP(query)

    // Step 2: Create search request record
    console.log("[v0] Step 2: Creating search request...")
    const searchRequest = await sql`
      INSERT INTO search_requests (account_id, raw_query, icp, desired_count, status)
      VALUES (${accountId}, ${query}, ${JSON.stringify(icp)}, ${desired_count}, 'processing')
      RETURNING *
    `

    const searchId = searchRequest[0].id

    console.log("[v0] Created search request:", searchId)

    // Step 3: Generate search queries
    console.log("[v0] Step 3: Generating search queries...")
    const searchQueries = await generateSearchQueries(query, icp)

    // Step 4: Run workers in parallel
    console.log("[v0] Step 4: Running workers...")
    const workers = [new PerplexityWorker()]

    const workerResults = await Promise.allSettled(
      workers.map((worker) =>
        Promise.race([
          worker.search(searchQueries, icp),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), worker.timeout)),
        ]),
      ),
    )

    console.log("[v0] Step 5: Saving companies...")
    const allCompanies: any[] = []

    for (const result of workerResults) {
      if (result.status === "fulfilled") {
        const workerResult = result.value as any
        console.log("[v0] Worker", workerResult.source, "found", workerResult.companies.length, "companies")

        for (const companyResult of workerResult.companies) {
          try {
            // Insert company directly into database
            const inserted = await sql`
              INSERT INTO companies (
                name, domain, description, industry, location, website,
                employee_count, revenue_range, funding_stage,
                technologies, sources, data_quality_score
              ) VALUES (
                ${companyResult.name},
                ${companyResult.domain || null},
                ${companyResult.description || null},
                ${companyResult.industry || null},
                ${companyResult.location || null},
                ${companyResult.website || null},
                ${companyResult.employee_count || null},
                ${companyResult.revenue_range || null},
                ${companyResult.funding_stage || null},
                ${companyResult.technologies || []},
                ${JSON.stringify([companyResult.source])},
                ${companyResult.confidence_score ? Math.round(companyResult.confidence_score * 100) : 50}
              )
              RETURNING *
            `

            const savedCompany = inserted[0]

            // Link search result
            await sql`
              INSERT INTO search_results (search_id, company_id, source, score)
              VALUES (${searchId}, ${savedCompany.id}, ${workerResult.source}, ${companyResult.confidence_score || 0})
              ON CONFLICT (search_id, company_id) DO NOTHING
            `

            allCompanies.push(savedCompany)
          } catch (error: any) {
            console.error("[v0] Error saving company:", error.message)
          }
        }
      } else {
        console.error("[v0] Worker failed:", result.reason)
      }
    }

    // Step 6: Mark search as completed
    await sql`
      UPDATE search_requests 
      SET status = 'completed', completed_at = now()
      WHERE id = ${searchId}
    `

    console.log("[v0] Search completed with", allCompanies.length, "companies")

    return NextResponse.json({
      success: true,
      search_id: searchId,
      icp,
      companies: allCompanies,
      count: allCompanies.length,
    })
  } catch (error: any) {
    console.error("[v0] Search V2 error:", error)

    return NextResponse.json(
      {
        error: error.message || "Failed to search companies",
        details: error.stack,
      },
      { status: 500 },
    )
  }
}
