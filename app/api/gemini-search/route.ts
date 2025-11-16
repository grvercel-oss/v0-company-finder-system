import { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { getFaviconUrl } from "@/lib/favicon"

export const runtime = "edge"
export const maxDuration = 60

function repairJSON(text: string): string {
  // Remove markdown code blocks
  text = text.replace(/\`\`\`json\s*/g, '').replace(/\`\`\`\s*/g, '')
  
  // Find JSON array
  const arrayStart = text.indexOf('[')
  const arrayEnd = text.lastIndexOf(']')
  
  if (arrayStart === -1 || arrayEnd === -1) {
    return '[]'
  }
  
  let json = text.substring(arrayStart, arrayEnd + 1)
  
  // Fix common issues
  json = json.replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
  json = json.replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
  json = json.replace(/"([^"]*)":\s*"([^"]*?)"/g, (match, key, value) => {
    // Escape unescaped quotes in values
    const escapedValue = value.replace(/"/g, '\\"')
    return `"${key}":"${escapedValue}"`
  })
  
  // Try to close unterminated strings/objects
  const openBraces = (json.match(/{/g) || []).length
  const closeBraces = (json.match(/}/g) || []).length
  if (openBraces > closeBraces) {
    json += '}'.repeat(openBraces - closeBraces)
  }
  
  return json
}

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
        const MAX_ATTEMPTS = 10 // Prevent infinite loops
        
        console.log(`[v0] Starting Gemini search: "${query}" - Target: ${totalCompanies} companies`)

        const existingDomains = new Set<string>()

        const searchRequest = await sql`
          INSERT INTO search_requests (account_id, raw_query, desired_count, status)
          VALUES (${accountId}, ${query}, ${totalCompanies}, 'processing')
          RETURNING *
        `
        const searchId = searchRequest[0].id

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: "start", 
            searchId,
            totalCompanies, 
            batchSize: BATCH_SIZE 
          })}\n\n`)
        )

        let totalSaved = 0
        const foundDomains = new Set<string>()
        let attemptCount = 0
        const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

        while (totalSaved < totalCompanies && attemptCount < MAX_ATTEMPTS) {
          attemptCount++
          const remaining = totalCompanies - totalSaved
          const companiesInThisBatch = Math.min(BATCH_SIZE, remaining)
          
          console.log(`[v0] Attempt ${attemptCount}: Need ${remaining} more companies (requesting ${companiesInThisBatch})`)
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "batch_start", 
              attemptNumber: attemptCount,
              totalSaved,
              remaining,
              companiesRequested: companiesInThisBatch
            })}\n\n`)
          )

          try {
            const excludedDomains = Array.from(foundDomains)
            const exclusionPrompt = excludedDomains.length > 0 
              ? `\n\nIMPORTANT: EXCLUDE these companies (already found):\n${excludedDomains.slice(0, 50).join(', ')}`
              : ''

            const searchPrompt = `Find ${companiesInThisBatch} UNIQUE companies matching: ${query}${exclusionPrompt}

Return ONLY a valid JSON array with this exact structure:
[{
  "name": "Company Name",
  "domain": "example.com",
  "website": "https://example.com",
  "description": "Brief 1-2 sentence description",
  "industry": "Industry",
  "location": "City, Country",
  "employee_count": "50-200",
  "founded_year": 2020,
  "revenue_range": "$1M-$10M",
  "funding_stage": "Series A",
  "technologies": "React, Node.js, AWS",
  "confidence_score": 0.85,
  "investors": [
    {
      "investor_name": "Investor Name",
      "investor_type": "VC Fund",
      "investment_amount": "$5M",
      "investment_round": "Series A",
      "investment_date": "2023-01-15",
      "investment_year": 2023
    }
  ]
}]

Rules:
- Return ONLY the JSON array, no markdown, no explanation
- DO NOT include any companies from the exclusion list
- Each company must have a unique domain
- Include top 3 investors per company
- Keep descriptions under 2 sentences
- Use null for unknown fields`

            const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  role: "user",
                  parts: [{ text: searchPrompt }],
                }],
                tools: [{ google_search: {} }],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 4096,
                },
              }),
            })

            const data = await response.json()

            if (!response.ok) {
              throw new Error(data.error?.message || response.statusText)
            }

            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text

            if (!responseText) {
              throw new Error("No response from Gemini")
            }

            console.log(`[v0] Attempt ${attemptCount} raw response length: ${responseText.length}`)

            const repairedJSON = repairJSON(responseText)
            
            let parsedResults: any[]
            try {
              parsedResults = JSON.parse(repairedJSON)

              if (!Array.isArray(parsedResults)) {
                throw new Error("Response is not an array")
              }
              
              console.log(`[v0] Attempt ${attemptCount}: parsed ${parsedResults.length} companies`)
            } catch (parseError: any) {
              console.error(`[v0] Attempt ${attemptCount} parse error:`, parseError.message)
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: "batch_error", 
                  attemptNumber: attemptCount,
                  error: "Failed to parse JSON response" 
                })}\n\n`)
              )
              continue // Continue to next attempt
            }

            const uniqueResults = parsedResults.filter(company => {
              const domain = (company.domain || company.name.toLowerCase().replace(/\s+/g, "")).toLowerCase()
              
              if (foundDomains.has(domain)) {
                console.log(`[v0] Skipping duplicate: ${domain}`)
                return false
              }
              
              foundDomains.add(domain)
              return true
            })

            console.log(`[v0] Attempt ${attemptCount}: ${uniqueResults.length} unique companies`)

            for (const company of uniqueResults) {
              if (totalSaved >= totalCompanies) {
                console.log(`[v0] Target reached (${totalCompanies}), stopping`)
                break
              }

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
                  RETURNING *
                `

                const savedCompany = inserted[0]

                await sql`
                  INSERT INTO search_results (search_id, company_id, source, score)
                  VALUES (${searchId}, ${savedCompany.id}, ${'Gemini Search'}, ${company.confidence_score || 0.7})
                `

                const investors = company.investors || []
                const savedInvestors = []

                for (const investor of investors.slice(0, 3)) {
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
                    attemptNumber: attemptCount,
                    totalSaved,
                    remaining: totalCompanies - totalSaved
                  })}\n\n`)
                )

                console.log(`[v0] Saved company ${totalSaved}/${totalCompanies}: ${company.name}`)
              } catch (dbError: any) {
                console.error(`[v0] Error saving company:`, company.name, dbError.message)
              }
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: "batch_complete", 
                attemptNumber: attemptCount,
                companiesSaved: uniqueResults.length,
                totalSaved,
                targetMet: totalSaved >= totalCompanies
              })}\n\n`)
            )

          } catch (batchError: any) {
            console.error(`[v0] Attempt ${attemptCount} error:`, batchError.message)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: "batch_error", 
                attemptNumber: attemptCount,
                error: batchError.message 
              })}\n\n`)
            )
          }
        }

        const targetMet = totalSaved >= totalCompanies

        await sql`
          UPDATE search_requests 
          SET status = 'completed', completed_at = now()
          WHERE id = ${searchId}
        `

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: "complete", 
            totalSaved,
            searchId,
            targetMet,
            attempts: attemptCount
          })}\n\n`)
        )

        console.log(`[v0] Search complete: ${totalSaved}/${totalCompanies} companies (${attemptCount} attempts)`)
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
