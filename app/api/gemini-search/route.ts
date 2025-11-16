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

        const companySchema = {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              domain: { type: "string" },
              website: { type: "string" },
              description: { type: "string" },
              industry: { type: "string" },
              location: { type: "string" },
              employee_count: { type: "string" },
              founded_year: { type: "integer" },
              revenue_range: { type: "string" },
              funding_stage: { type: "string" },
              technologies: { type: "string" },
              confidence_score: { type: "number" },
              investors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    investor_name: { type: "string" },
                    investor_type: { type: "string" },
                    investment_amount: { type: "string" },
                    investment_round: { type: "string" },
                    investment_date: { type: "string" },
                    investment_year: { type: "integer" }
                  },
                  required: ["investor_name"]
                }
              }
            },
            required: ["name", "domain"]
          }
        }

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
            const searchPrompt = `Find ${companiesInThisBatch} companies that match: ${query}

For each company provide:
- Name, domain/website, brief description (1-2 sentences)
- Industry, location, approximate employee count
- Founded year, funding stage
- Top 3-5 key investors with investment details (name, type, amount, round, date/year)

Focus on essential, current information.`

            const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

            console.log(`[v0] Step 1: Getting grounded data with google_search...`)

            const searchResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: searchPrompt }],
                  },
                ],
                tools: [{ google_search: {} }],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 6144,
                },
              }),
            })

            const searchData = await searchResponse.json()

            if (!searchResponse.ok) {
              throw new Error(searchData.error?.message || searchResponse.statusText)
            }

            const groundedText = searchData.candidates?.[0]?.content?.parts?.[0]?.text

            if (!groundedText) {
              throw new Error("No response from Gemini search")
            }

            console.log(`[v0] Step 1 complete. Response length: ${groundedText.length}`)

            const structurePrompt = `Convert this research data to a JSON array. Keep descriptions brief (1-2 sentences). Limit to top 5 investors per company.

Research data:
${groundedText}

Output valid JSON only.`

            console.log(`[v0] Step 2: Converting to structured JSON...`)

            const structureResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: structurePrompt }],
                  },
                ],
                generationConfig: {
                  temperature: 0,
                  maxOutputTokens: 8192,
                  responseMimeType: "application/json",
                  responseSchema: companySchema,
                },
              }),
            })

            const structureData = await structureResponse.json()

            if (!structureResponse.ok) {
              throw new Error(structureData.error?.message || structureResponse.statusText)
            }

            const jsonText = structureData.candidates?.[0]?.content?.parts?.[0]?.text

            if (!jsonText) {
              throw new Error("No structured response from Gemini")
            }

            console.log(`[v0] Step 2 complete. JSON length: ${jsonText.length}`)

            let parsedResults: any[]
            try {
              parsedResults = JSON.parse(jsonText)

              if (!Array.isArray(parsedResults)) {
                throw new Error("Response is not an array")
              }
              
              console.log(`[v0] Successfully parsed ${parsedResults.length} companies from batch ${batchIndex + 1}`)
            } catch (parseError: any) {
              console.error(`[v0] Batch ${batchIndex + 1} parse error:`, parseError.message)
              console.error(`[v0] JSON that failed:`, jsonText)
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: "batch_error", 
                  batchIndex: batchIndex + 1,
                  error: "Failed to parse structured JSON" 
                })}\n\n`)
              )
              continue
            }

            for (const company of parsedResults) {
              try {
                const domain = company.domain || company.name.toLowerCase().replace(/\s+/g, "")
                const website = company.website || (company.domain ? `https://${company.domain}` : null)
                const faviconUrl = getFaviconUrl(website || domain)

                const technologies = typeof company.technologies === 'string' 
                  ? company.technologies.split(',').map((t: string) => t.trim()).filter(Boolean)
                  : (company.technologies || [])

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
                    ${technologies},
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
                        ${null},
                        ${investor.investment_amount || null},
                        ${investor.investment_round || null},
                        ${investor.investment_date || null},
                        ${investor.investment_year || null},
                        ${'Gemini Search'},
                        ${company.confidence_score || 0.7}
                      )
                      ON CONFLICT (company_id, investor_name, investment_round) DO UPDATE SET
                        investor_type = COALESCE(EXCLUDED.investor_type, investors.investor_type),
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
