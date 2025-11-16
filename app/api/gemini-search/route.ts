import { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { getFaviconUrl } from "@/lib/favicon"

export const runtime = "edge"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const accountId = await getAccountIdFromRequest(request)
        
        const { query, totalCompanies = 10 } = await request.json()

        if (!query) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Query is required" })}\n\n`))
          controller.close()
          return
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY

        if (!GEMINI_API_KEY) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Gemini API key not configured" })}\n\n`))
          controller.close()
          return
        }

        const BATCH_SIZE = 5
        const numBatches = Math.ceil(totalCompanies / BATCH_SIZE)
        
        console.log(`[v0] Starting Gemini search: "${query}" - Total: ${totalCompanies}, Batches: ${numBatches}`)

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: "start", 
            totalCompanies, 
            numBatches,
            batchSize: BATCH_SIZE 
          })}\n\n`)
        )

        let totalSaved = 0

        for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
          const companiesInThisBatch = Math.min(BATCH_SIZE, totalCompanies - (batchIndex * BATCH_SIZE))
          
          console.log(`[v0] Processing batch ${batchIndex + 1}/${numBatches} (${companiesInThisBatch} companies)`)
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "batch_start", 
              batchIndex: batchIndex + 1,
              totalBatches: numBatches,
              companiesInBatch: companiesInThisBatch
            })}\n\n`)
          )

          try {
            const batchPrompt = `You are a JSON-ONLY API. Return ONLY valid JSON. NO explanations, NO markdown, NO code blocks, NO extra text.

User query: "${query}"

Task:
1. Normalize query: extract industry, region from the query.
2. Use Google Search grounding to find EXACTLY ${companiesInThisBatch} REAL companies matching the criteria.
3. For EACH company, also search for their investors and funding information.
4. Return ONLY this JSON array structure (no other text):

[
  {
    "name": "string (required, company name)",
    "domain": "string (domain only, e.g., 'company.com')",
    "website": "string (full URL, e.g., 'https://company.com')",
    "description": "string (brief description)",
    "industry": "string",
    "location": "string (city, country)",
    "employee_count": "string (e.g., '100-500' or '1000+')",
    "founded_year": number,
    "revenue_range": "string (e.g., '$10M-$50M' or 'Undisclosed')",
    "funding_stage": "string (e.g., 'Series A', 'Seed', 'Public')",
    "technologies": ["string"],
    "confidence_score": number (0.0-1.0),
    "investors": [
      {
        "investor_name": "string (VC fund, angel investor, or corporate name)",
        "investor_type": "string (VC, Angel, Corporate, PE, etc.)",
        "investor_website": "string (investor's website URL if available)",
        "investment_amount": "string (e.g., '$10M', 'Undisclosed')",
        "investment_round": "string (e.g., 'Seed', 'Series A', 'Series B')",
        "investment_date": "string (YYYY-MM-DD format if known)",
        "investment_year": number (year only if full date unknown)
      }
    ]
  }
]

CRITICAL RULES:
- Return EXACTLY ${companiesInThisBatch} companies (no more, no less)
- Start with [ and end with ]
- NO text before or after the JSON
- Use real company AND investor data from Google Search
- Include as many investors as you can find for each company
- If no investors found for a company: set "investors": []
- All string values must be properly quoted
- All numeric values must be numbers (not strings)
- No trailing commas

START JSON NOW:`

            const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

            const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: batchPrompt }],
                  },
                ],
                tools: [{ google_search: {} }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 4096, // Reduced for 5 companies
                },
              }),
            })

            const responseData = await response.json()

            if (!response.ok) {
              throw new Error(responseData.error?.message || response.statusText)
            }

            const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text

            if (!rawText) {
              throw new Error("No response from Gemini")
            }

            let parsedResults: any[]
            try {
              let jsonString = rawText.trim()
              
              // Remove markdown
              jsonString = jsonString.replace(/```json\s*/g, "").replace(/```\s*/g, "")
              
              // Extract array
              const arrayStart = jsonString.indexOf("[")
              const arrayEnd = jsonString.lastIndexOf("]")
              
              if (arrayStart !== -1 && arrayEnd !== -1) {
                jsonString = jsonString.substring(arrayStart, arrayEnd + 1)
              }

              parsedResults = JSON.parse(jsonString)

              if (!Array.isArray(parsedResults)) {
                throw new Error("Response is not an array")
              }
            } catch (parseError: any) {
              console.error(`[v0] Batch ${batchIndex + 1} parse error:`, parseError.message)
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: "batch_error", 
                  batchIndex: batchIndex + 1,
                  error: "Failed to parse results" 
                })}\n\n`)
              )
              continue
            }

            for (const company of parsedResults) {
              try {
                const domain = company.domain || company.name.toLowerCase().replace(/\s+/g, "")
                const website = company.website || (company.domain ? `https://${company.domain}` : null)
                const faviconUrl = getFaviconUrl(website || domain)

                const inserted = await sql`
                  INSERT INTO companies (
                    name, domain, description, industry, location, website,
                    employee_count, revenue_range, funding_stage, founded_year,
                    technologies, data_quality_score, logo_url, verified
                  ) VALUES (
                    ${company.name},
                    ${domain},
                    ${company.description || null},
                    ${company.industry || null},
                    ${company.location || null},
                    ${website},
                    ${company.employee_count || null},
                    ${company.revenue_range || null},
                    ${company.funding_stage || null},
                    ${company.founded_year || null},
                    ${company.technologies || []},
                    ${company.confidence_score ? Math.round(company.confidence_score * 100) : 70},
                    ${faviconUrl},
                    false
                  )
                  ON CONFLICT (domain) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = COALESCE(EXCLUDED.description, companies.description),
                    industry = COALESCE(EXCLUDED.industry, companies.industry),
                    location = COALESCE(EXCLUDED.location, companies.location),
                    website = COALESCE(EXCLUDED.website, companies.website),
                    employee_count = COALESCE(EXCLUDED.employee_count, companies.employee_count),
                    logo_url = COALESCE(EXCLUDED.logo_url, companies.logo_url),
                    last_updated = now()
                  RETURNING *
                `

                const savedCompany = inserted[0]

                const investors = company.investors || []
                const savedInvestors = []

                for (const investor of investors) {
                  try {
                    const investorInserted = await sql`
                      INSERT INTO investors (
                        company_id, investor_name, investor_type, investor_website,
                        investment_amount, investment_round, investment_date, investment_year,
                        source, confidence_score
                      ) VALUES (
                        ${savedCompany.id},
                        ${investor.investor_name},
                        ${investor.investor_type || null},
                        ${investor.investor_website || null},
                        ${investor.investment_amount || null},
                        ${investor.investment_round || null},
                        ${investor.investment_date || null},
                        ${investor.investment_year || null},
                        ${'Gemini Search'},
                        ${company.confidence_score || 0.7}
                      )
                      ON CONFLICT (company_id, investor_name, investment_round) DO UPDATE SET
                        investor_type = COALESCE(EXCLUDED.investor_type, investors.investor_type),
                        investor_website = COALESCE(EXCLUDED.investor_website, investors.investor_website),
                        investment_amount = COALESCE(EXCLUDED.investment_amount, investors.investment_amount),
                        investment_date = COALESCE(EXCLUDED.investment_date, investors.investment_date),
                        updated_at = now()
                      RETURNING *
                    `
                    savedInvestors.push(investorInserted[0])
                  } catch (investorError) {
                    console.error(`[v0] Error saving investor:`, investor.investor_name)
                  }
                }

                savedCompany.investors = savedInvestors
                totalSaved++

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: "company", 
                    company: savedCompany,
                    batchIndex: batchIndex + 1,
                    totalSaved
                  })}\n\n`)
                )
              } catch (dbError: any) {
                console.error(`[v0] Error saving company:`, company.name, dbError.message)
              }
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: "batch_complete", 
                batchIndex: batchIndex + 1,
                companiesSaved: parsedResults.length
              })}\n\n`)
            )

          } catch (batchError: any) {
            console.error(`[v0] Batch ${batchIndex + 1} error:`, batchError.message)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: "batch_error", 
                batchIndex: batchIndex + 1,
                error: batchError.message 
              })}\n\n`)
            )
          }
        }

        try {
          await sql`
            INSERT INTO search_history (query, results_count, search_timestamp)
            VALUES (${query}, ${totalSaved}, NOW())
          `
        } catch (historyError) {
          console.error("[v0] Error saving search history:", historyError)
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: "complete", 
            totalSaved
          })}\n\n`)
        )

        console.log(`[v0] Search complete: ${totalSaved} companies saved`)
        controller.close()

      } catch (error: any) {
        console.error("[v0] Stream error:", error)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
