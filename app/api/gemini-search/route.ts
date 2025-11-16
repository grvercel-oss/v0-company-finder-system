import { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getFaviconUrl } from "@/lib/favicon"

export const runtime = "edge"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || query.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Query must be at least 3 characters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      console.error("[v0] GEMINI_API_KEY not found")
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          send("status", { message: "Starting Gemini search..." })
          console.log("[v0] Starting Gemini search for:", query)

          const prompt = `Find companies matching: "${query}"

Return ONLY valid JSON array (no markdown, no text before/after):
[
  {
    "name": "Company Name",
    "domain": "company.com",
    "website": "https://company.com",
    "description": "Brief description",
    "industry": "Industry",
    "location": "City, Country",
    "employee_count": "50-200",
    "founded_year": 2020,
    "revenue_range": "$5M-$20M",
    "funding_stage": "Series A",
    "technologies": ["Tech1", "Tech2"],
    "confidence_score": 0.85,
    "investors": [
      {
        "investor_name": "VC Name",
        "investor_type": "VC",
        "investor_website": "https://vc.com",
        "investment_amount": "$5M",
        "investment_round": "Series A",
        "investment_date": "2023-06-15",
        "investment_year": 2023
      }
    ]
  }
]

Find 10 real companies with investor information.`

          const GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

          send("status", { message: "Querying Gemini AI..." })

          const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              tools: [{ google_search: {} }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
              },
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error("[v0] Gemini API error:", errorData)
            throw new Error(errorData.error?.message || `API error: ${response.statusText}`)
          }

          const responseData = await response.json()
          const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text

          if (!rawText) {
            throw new Error("No response from Gemini")
          }

          send("status", { message: "Processing results..." })
          console.log("[v0] Raw response length:", rawText.length)

          let parsedResults: any[]
          try {
            let jsonString = rawText.trim()
            
            // Remove markdown code blocks
            jsonString = jsonString.replace(/\`\`\`json\s*/g, "").replace(/\`\`\`\s*/g, "")
            
            // Find JSON array boundaries
            const arrayStart = jsonString.indexOf("[")
            const arrayEnd = jsonString.lastIndexOf("]")

            if (arrayStart === -1 || arrayEnd === -1) {
              throw new Error("No JSON array found in response")
            }

            jsonString = jsonString.substring(arrayStart, arrayEnd + 1)
            
            // Clean up common JSON issues:
            // 1. Remove trailing commas before } or ]
            jsonString = jsonString.replace(/,(\s*[}\]])/g, "$1")
            
            // 2. Remove parenthetical notes after numbers like "2018 (Ubigi brand)"
            jsonString = jsonString.replace(/(\d{4})\s*$$[^)]+$$/g, "$1")
            
            // 3. Remove text after commas in number fields like "2000 (Transatel),"
            jsonString = jsonString.replace(/:\s*\d+\s*$$[^)]+$$,/g, (match) => {
              const num = match.match(/:\s*(\d+)/)?.[1]
              return `: ${num},`
            })
            
            // 4. Fix unquoted property names
            jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
            
            // 5. Escape unescaped quotes in string values
            jsonString = jsonString.replace(/:\s*"([^"]*)"([^,}\]]*)"([^,}\]]*)",/g, (match, p1, p2, p3) => {
              return `: "${p1}\\"${p2}\\"${p3}",`
            })

            console.log("[v0] Cleaned JSON first 500 chars:", jsonString.substring(0, 500))

            parsedResults = JSON.parse(jsonString)

            if (!Array.isArray(parsedResults)) {
              throw new Error("Parsed result is not an array")
            }
          } catch (parseError: any) {
            console.error("[v0] Parse error:", parseError.message)
            console.error("[v0] Failed JSON substring:", rawText.substring(0, 1000))
            send("error", { message: "Failed to parse AI response. Please try again." })
            controller.close()
            return
          }

          console.log("[v0] Parsed", parsedResults.length, "companies")
          send("progress", { total: 0, target: parsedResults.length })

          let savedCount = 0
          for (const company of parsedResults) {
            try {
              if (!company.name) continue

              const domain = company.domain || company.name.toLowerCase().replace(/\s+/g, "") + ".com"
              const website = company.website || `https://${domain}`
              const faviconUrl = getFaviconUrl(website)

              const [savedCompany] = await sql`
                INSERT INTO companies (
                  name, domain, description, industry, location, website,
                  employee_count, revenue_range, funding_stage, founded_year,
                  technologies, data_quality_score, logo_url, verified
                ) VALUES (
                  ${company.name}, ${domain}, ${company.description || null},
                  ${company.industry || null}, ${company.location || null}, ${website},
                  ${company.employee_count || null}, ${company.revenue_range || null},
                  ${company.funding_stage || null}, ${company.founded_year || null},
                  ${company.technologies || []},
                  ${company.confidence_score ? Math.round(company.confidence_score * 100) : 70},
                  ${faviconUrl}, false
                )
                ON CONFLICT (domain) DO UPDATE SET
                  name = EXCLUDED.name,
                  description = COALESCE(EXCLUDED.description, companies.description),
                  industry = COALESCE(EXCLUDED.industry, companies.industry),
                  location = COALESCE(EXCLUDED.location, companies.location),
                  last_updated = NOW()
                RETURNING *
              `

              // Save investors
              const investors = company.investors || []
              const savedInvestors = []

              for (const investor of investors) {
                if (!investor.investor_name) continue

                try {
                  const [savedInvestor] = await sql`
                    INSERT INTO investors (
                      company_id, investor_name, investor_type, investor_website,
                      investment_amount, investment_round, investment_date, investment_year,
                      source, confidence_score
                    ) VALUES (
                      ${savedCompany.id}, ${investor.investor_name}, ${investor.investor_type || null},
                      ${investor.investor_website || null}, ${investor.investment_amount || null},
                      ${investor.investment_round || null}, ${investor.investment_date || null},
                      ${investor.investment_year || null}, 'Gemini Search', ${company.confidence_score || 0.7}
                    )
                    ON CONFLICT (company_id, investor_name, investment_round) DO UPDATE SET
                      investor_type = COALESCE(EXCLUDED.investor_type, investors.investor_type),
                      updated_at = NOW()
                    RETURNING *
                  `
                  savedInvestors.push(savedInvestor)
                } catch (err: any) {
                  console.error("[v0] Error saving investor:", err.message)
                }
              }

              savedCompany.investors = savedInvestors
              savedCount++

              send("new_company", {
                company: savedCompany,
                is_new: true,
                source: "Gemini Search",
              })

              send("progress", { total: savedCount, target: parsedResults.length })

              console.log("[v0] Saved:", company.name, "with", savedInvestors.length, "investors")
            } catch (err: any) {
              console.error("[v0] Error saving company:", err.message)
            }
          }

          // Save search history
          try {
            await sql`
              INSERT INTO search_history (query, results_count, search_timestamp)
              VALUES (${query}, ${savedCount}, NOW())
            `
          } catch (err) {
            console.error("[v0] Error saving search history:", err)
          }

          send("search_completed", { total: savedCount })
          console.log("[v0] Search complete:", savedCount, "companies saved")
          controller.close()
        } catch (error: any) {
          console.error("[v0] Gemini search error:", error.message)
          send("error", { message: error.message || "Search failed" })
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
  } catch (error: any) {
    console.error("[v0] Request error:", error.message)
    return new Response(JSON.stringify({ error: error.message || "Search failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
