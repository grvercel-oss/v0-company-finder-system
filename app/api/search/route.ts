import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { checkDatabaseSetup, initializeDatabase } from "@/lib/db-init"
import { searchCompaniesWithPerplexity } from "@/lib/perplexity"
import { enrichCompanyDataWithOpenAI } from "@/lib/openai"
import { trackAIUsage } from "@/lib/ai-cost-tracker"
import { auth } from "@clerk/nextjs/server"

export async function POST(request: NextRequest) {
  console.log("[v0] Search API called")

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dbCheck = await checkDatabaseSetup()
    console.log("[v0] Database setup status:", dbCheck)

    if (!dbCheck.isSetup) {
      console.log("[v0] Database not set up, initializing...")
      const initResult = await initializeDatabase()

      if (!initResult.success) {
        console.error("[v0] Failed to initialize database:", initResult.error)
        return NextResponse.json(
          {
            error: "Database initialization failed",
            details: initResult.error,
            message: "Please ensure your database is accessible and you have proper permissions.",
          },
          { status: 500 },
        )
      }

      console.log("[v0] Database initialized successfully")
    }

    const body = await request.json()
    const { query, filters } = body

    console.log("[v0] Request body:", { query, filters })

    if (!query) {
      console.error("[v0] No query provided")
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    console.log("[v0] Starting company search for query:", query)

    // Search using Perplexity
    const searchResults = await searchCompaniesWithPerplexity(query, filters)
    console.log("[v0] Perplexity search completed, found", searchResults.companies.length, "companies")

    if (searchResults.usage) {
      await trackAIUsage({
        sql,
        accountId: userId,
        model: "perplexity/sonar",
        promptTokens: searchResults.usage.input_tokens,
        completionTokens: searchResults.usage.output_tokens,
        generationType: "company_search",
      })
      console.log("[v0] Perplexity cost tracked: $", searchResults.usage.cost.toFixed(6))
    }

    let totalOpenAICost = 0
    let totalOpenAIInputTokens = 0
    let totalOpenAIOutputTokens = 0

    // Process and enrich each company
    const enrichedCompanies = await Promise.all(
      searchResults.companies.map(async (company, index) => {
        console.log(`[v0] Processing company ${index + 1}/${searchResults.companies.length}:`, company.name)

        try {
          // Check if company already exists in database
          const existing = await sql`
            SELECT * FROM companies 
            WHERE (domain IS NOT NULL AND domain = ${company.domain || null}) 
            OR name = ${company.name}
            LIMIT 1
          `

          if (existing.length > 0) {
            console.log("[v0] Company already exists in database:", company.name)
            return existing[0]
          }

          console.log("[v0] Enriching new company with OpenAI:", company.name)
          // Enrich with OpenAI
          const enrichment = await enrichCompanyDataWithOpenAI(company)

          if (enrichment.usage) {
            totalOpenAICost += enrichment.usage.cost
            totalOpenAIInputTokens += enrichment.usage.input_tokens
            totalOpenAIOutputTokens += enrichment.usage.output_tokens

            await trackAIUsage({
              sql,
              accountId: userId,
              model: "gpt-4o-mini",
              promptTokens: enrichment.usage.input_tokens,
              completionTokens: enrichment.usage.output_tokens,
              generationType: "company_enrichment",
            })
            console.log("[v0] OpenAI enrichment cost tracked: $", enrichment.usage.cost.toFixed(6))
          }

          console.log("[v0] Saving company to database:", company.name)
          const inserted = await sql`
            INSERT INTO companies (
              name, domain, description, industry, location, website,
              linkedin_url, twitter_url,
              employee_count, revenue_range, funding_stage, total_funding,
              founded_year,
              technologies, keywords, ai_summary, data_quality_score,
              raw_data
            ) VALUES (
              ${company.name},
              ${company.domain || null},
              ${company.description || null},
              ${company.industry || null},
              ${enrichment.extractedInfo.headquarters || company.location || null},
              ${company.website || null},
              ${enrichment.extractedInfo.linkedin_url || null},
              ${enrichment.extractedInfo.twitter_url || null},
              ${enrichment.extractedInfo.employee_count || null},
              ${enrichment.extractedInfo.revenue_range || null},
              ${enrichment.extractedInfo.funding_stage || null},
              ${enrichment.extractedInfo.total_funding || null},
              ${enrichment.extractedInfo.founded_year || null},
              ${enrichment.extractedInfo.technologies || []},
              ${enrichment.extractedInfo.keywords || []},
              ${enrichment.summary},
              ${enrichment.quality_score},
              ${JSON.stringify({
                ...company,
                enrichment: {
                  email: enrichment.extractedInfo.email,
                  phone: enrichment.extractedInfo.phone,
                  contact_email_pattern: enrichment.extractedInfo.contact_email_pattern,
                  facebook_url: enrichment.extractedInfo.facebook_url,
                  instagram_url: enrichment.extractedInfo.instagram_url,
                  github_url: enrichment.extractedInfo.github_url,
                  ceo_name: enrichment.extractedInfo.ceo_name,
                  key_people: enrichment.extractedInfo.key_people,
                  recent_news: enrichment.extractedInfo.recent_news,
                  competitors: enrichment.extractedInfo.competitors,
                },
              })}
            )
            RETURNING *
          `

          console.log("[v0] Company saved successfully:", company.name)
          return inserted[0]
        } catch (companyError: any) {
          console.error(`[v0] Error processing company ${company.name}:`, companyError.message)
          console.error(`[v0] Error stack:`, companyError.stack)
          throw companyError
        }
      }),
    )

    console.log("[v0] All companies processed, saving search history")

    const perplexityCost = searchResults.usage?.cost || 0
    const totalCost = perplexityCost + totalOpenAICost

    console.log("[v0] Total search cost: $", totalCost.toFixed(6))
    console.log("[v0] - Perplexity: $", perplexityCost.toFixed(6))
    console.log("[v0] - OpenAI: $", totalOpenAICost.toFixed(6))

    // Save search history with cost tracking
    await sql`
      INSERT INTO search_history (
        query, 
        filters, 
        results_count,
        perplexity_input_tokens,
        perplexity_output_tokens,
        perplexity_cost,
        openai_input_tokens,
        openai_output_tokens,
        openai_cost,
        total_cost
      )
      VALUES (
        ${query}, 
        ${JSON.stringify(filters || {})}, 
        ${enrichedCompanies.length},
        ${searchResults.usage?.input_tokens || 0},
        ${searchResults.usage?.output_tokens || 0},
        ${perplexityCost},
        ${totalOpenAIInputTokens},
        ${totalOpenAIOutputTokens},
        ${totalOpenAICost},
        ${totalCost}
      )
    `

    console.log("[v0] Search completed successfully")

    return NextResponse.json({
      success: true,
      companies: enrichedCompanies,
      answer: searchResults.answer,
      citations: searchResults.citations,
      count: enrichedCompanies.length,
      cost: {
        perplexity: {
          input_tokens: searchResults.usage?.input_tokens || 0,
          output_tokens: searchResults.usage?.output_tokens || 0,
          cost: perplexityCost,
        },
        openai: {
          input_tokens: totalOpenAIInputTokens,
          output_tokens: totalOpenAIOutputTokens,
          cost: totalOpenAICost,
        },
        total: totalCost,
      },
    })
  } catch (error: any) {
    console.error("[v0] Search API error:", error)
    console.error("[v0] Error message:", error.message)
    console.error("[v0] Error stack:", error.stack)

    return NextResponse.json(
      {
        error: error.message || "Failed to search companies",
        details: error.stack,
        message: "An error occurred while searching for companies. Please check the logs for details.",
      },
      { status: 500 },
    )
  }
}
