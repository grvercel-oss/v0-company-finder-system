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
              ? `\n\nEXCLUDE these domains (already found): ${excludedDomains.slice(0, 20).join(', ')}`
              : ''

            const searchPrompt = `You are a precise firmographics extractor. Return ONLY a JSON array of ${companiesInThisBatch} companies.

User query: "${query}"${exclusionPrompt}

CRITICAL INSTRUCTIONS:
1. Use Google Search grounding with maximum results.
2. For EACH company: DEEPLY search these sources in order:
   - Crunchbase (for funding, investors, metrics)
   - LinkedIn (for employee count, locations, headcount trends)
   - Company website (for products, description, tech stack)
   - PitchBook (for valuations, detailed funding)
   - Recent news articles (for latest updates, revenue estimates)
   
3. PRIORITIZE finding these fields (search until found):
   - employee_count: Get EXACT range from LinkedIn (e.g. "101-200", "501-1000")
   - founded_year: Find exact year from multiple sources
   - revenue_range: Look for reports, news, Crunchbase estimates (e.g. "$10M-$50M")
   - location: Full address with city, state/region, country
   - industry: Detailed categorization (e.g. "Fintech - Digital Payments")
   - investors: Top 3-5 investors with full details

4. DATA QUALITY RULES:
   - If data exists online, YOU MUST INCLUDE IT
   - Do NOT guess or estimate - verify from sources
   - If genuinely not found after deep search: use "N/A" or null
   - Cross-reference data from multiple sources
   - Prioritize recent data (2023-2025)

5. INVESTOR DATA REQUIREMENTS:
   - Include investor website if found
   - Include investment date (exact if possible)
   - Include detailed round information (e.g. "Series A Extension")
   - Include investor type (VC, Angel, Corporate, PE, etc.)

Return ONLY this exact JSON structure:
[
  {
    "name": "string",
    "domain": "string",
    "website": "string",
    "description": "string (2-3 sentences, verified from official sources)",
    "industry": "string (detailed, e.g. 'Fintech - Payments')",
    "location": "string (full: city, state/region, country)",
    "employee_count": "string (exact range like '101-200' from LinkedIn or 'N/A')",
    "founded_year": number or null,
    "revenue_range": "string (e.g. '$10M-$50M' from verified sources or 'N/A')",
    "funding_stage": "string (latest round like 'Series B' or 'N/A')",
    "technologies": "string (comma-separated tech stack)",
    "confidence_score": number (0.0-1.0: 1.0 = all data verified, 0.5 = partial data, 0.7+ recommended),
    "investors": [
      {
        "investor_name": "string",
        "investor_type": "string (VC Fund/Angel/Corporate/PE)",
        "investment_amount": "string (e.g. '$5M')",
        "investment_round": "string (e.g. 'Series A')",
        "investment_date": "string (YYYY-MM-DD if known)",
        "investment_year": number
      }
    ]
  }
]

CRITICAL OUTPUT RULES:
- NO markdown formatting (no \`\`\`json, no \`\`\`)
- NO explanatory text before or after
- START with [ and END with ]
- Valid JSON only - properly escaped quotes, no trailing commas
- Each company MUST have unique domain
- DO NOT repeat any excluded companies`

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
