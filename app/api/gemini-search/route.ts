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

        function repairJSON(jsonString: string): string {
          let repaired = jsonString
          
          // Remove any text before first [ and after last ]
          const firstBracket = repaired.indexOf('[')
          const lastBracket = repaired.lastIndexOf(']')
          if (firstBracket !== -1 && lastBracket !== -1) {
            repaired = repaired.substring(firstBracket, lastBracket + 1)
          }
          
          // Fix unescaped quotes in strings - find patterns like "text "quoted" text"
          repaired = repaired.replace(/"([^"]*)"([^"]*)"([^"]*)":/g, (match, p1, p2, p3) => {
            // If middle part looks like a quoted phrase, escape it
            if (p2.trim()) {
              return `"${p1}\\"${p2}\\"${p3}":`
            }
            return match
          })
          
          // Remove trailing commas before closing brackets/braces
          repaired = repaired.replace(/,(\s*[}\]])/g, '$1')
          
          // Fix incomplete strings at end of file (truncation)
          if (!repaired.endsWith(']') && !repaired.endsWith('}]')) {
            // Try to close incomplete objects
            const openBraces = (repaired.match(/{/g) || []).length
            const closeBraces = (repaired.match(/}/g) || []).length
            const openBrackets = (repaired.match(/\[/g) || []).length
            const closeBrackets = (repaired.match(/\]/g) || []).length
            
            // Add missing closing braces
            for (let i = 0; i < openBraces - closeBraces; i++) {
              repaired += '}'
            }
            // Add missing closing brackets
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
              repaired += ']'
            }
          }
          
          // Fix incomplete property values (e.g., "investor_web instead of "investor_website": "...")
          // Remove incomplete properties at the end
          repaired = repaired.replace(/,\s*"[^"]*$/, '')
          repaired = repaired.replace(/,\s*"[^"]*:\s*"[^"]*$/, '')
          
          return repaired
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
            const batchPrompt = `Find ${companiesInThisBatch} ${query}.

For each company, also find their investors and funding information.

Return ONLY a JSON array with this EXACT structure (no other text, no markdown):

[
  {
    "name": "Company Name",
    "domain": "company.com",
    "website": "https://company.com",
    "description": "Brief description",
    "industry": "Industry name",
    "location": "City, Country",
    "employee_count": "100-500",
    "founded_year": 2020,
    "revenue_range": "$10M-$50M",
    "funding_stage": "Series A",
    "technologies": ["tech1", "tech2"],
    "confidence_score": 0.9,
    "investors": [
      {
        "investor_name": "Investor Name",
        "investor_type": "VC",
        "investor_website": "https://investor.com",
        "investment_amount": "$5M",
        "investment_round": "Seed",
        "investment_date": "2023-01-15",
        "investment_year": 2023
      }
    ]
  }
]

RULES:
- Return ONLY the JSON array (start with [ and end with ])
- NO markdown, NO explanations, NO code blocks
- All strings must use double quotes
- Numbers must be unquoted
- No trailing commas
- If investors unknown, use empty array []`

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
                  temperature: 0.1, // Lower temperature for more consistent output
                  maxOutputTokens: 4096,
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

            console.log(`[v0] Raw response length: ${rawText.length}`)

            let parsedResults: any[]
            try {
              let jsonString = rawText.trim()
              
              // Remove markdown code blocks
              jsonString = jsonString.replace(/\`\`\`json\s*/g, "").replace(/\`\`\`\s*/g, "")
              
              // Remove any explanatory text before/after JSON
              const arrayStart = jsonString.indexOf("[")
              const arrayEnd = jsonString.lastIndexOf("]")
              
              if (arrayStart === -1 || arrayEnd === -1) {
                throw new Error("No JSON array found in response")
              }
              
              jsonString = jsonString.substring(arrayStart, arrayEnd + 1)
              
              jsonString = repairJSON(jsonString)
              
              console.log(`[v0] Attempting to parse JSON (first 500 chars): ${jsonString.substring(0, 500)}...`)

              parsedResults = JSON.parse(jsonString)

              if (!Array.isArray(parsedResults)) {
                throw new Error("Response is not an array")
              }
              
              console.log(`[v0] Successfully parsed ${parsedResults.length} companies from batch ${batchIndex + 1}`)
            } catch (parseError: any) {
              console.error(`[v0] Batch ${batchIndex + 1} parse error:`, parseError.message)
              console.error(`[v0] Failed JSON snippet (around error): ${rawText.substring(Math.max(0, parseError.position - 100), parseError.position + 100)}`)
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: "batch_error", 
                  batchIndex: batchIndex + 1,
                  error: "Failed to parse results from Gemini" 
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
