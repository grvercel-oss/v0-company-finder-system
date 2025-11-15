import { NextRequest, NextResponse } from "next/server"
import type { Company } from "@/lib/db"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
    }

    const GEMINI_URL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

    const prompt = `Search the web and find 10 real companies matching: "${query}". 
For each company, provide: name, industry, location (city, country), approximate employee count, founded year, estimated revenue, description, and website URL.
Return the results as a JSON array with this exact structure:
[{"name":"Company Name","industry":"Industry","location":"City, Country","employees":100,"founded":2020,"revenue":"$10M","funding":"$5M","description":"Brief description","website":"https://example.com"}]`

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        tools: [
          {
            google_search: {}
          }
        ],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error("[v0] Gemini API error:", JSON.stringify(responseData, null, 2))
      const errorMessage = responseData.error?.message || response.statusText
      throw new Error(`Gemini API error: ${errorMessage}`)
    }

    const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      console.error("[v0] No text in Gemini response:", JSON.stringify(responseData, null, 2))
      throw new Error("No response from Gemini")
    }

    let results
    try {
      // Try multiple extraction methods
      let jsonText = text
      
      // Method 1: Extract from markdown code blocks
      const codeBlockMatch = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/)
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1]
      } else {
        // Method 2: Find JSON array in text (look for [ ... ])
        const arrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/)
        if (arrayMatch) {
          jsonText = arrayMatch[0]
        } else {
          // Method 3: Try to find where JSON starts (after any preamble text)
          const jsonStartIndex = text.indexOf('[{')
          if (jsonStartIndex !== -1) {
            const jsonEndIndex = text.lastIndexOf('}]')
            if (jsonEndIndex !== -1) {
              jsonText = text.substring(jsonStartIndex, jsonEndIndex + 2)
            }
          }
        }
      }
      
      results = JSON.parse(jsonText.trim())
    } catch (parseError) {
      console.error("[v0] Failed to parse Gemini response:", text)
      throw new Error("Failed to parse company data from Gemini")
    }

    if (!Array.isArray(results)) {
      throw new Error("Invalid response format from Gemini")
    }

    const companies: Company[] = results.map((r: any, i: number) => ({
      id: -(i + 1),
      name: r.name || "Unknown",
      domain: r.website || undefined,
      description: r.description || "",
      industry: r.industry || "Unknown",
      size: `${r.employees || 0} employees`,
      location: r.location || "Unknown",
      founded_year: r.founded || null,
      website: r.website || undefined,
      employee_count: String(r.employees || 0),
      revenue_range: r.revenue || null,
      total_funding: r.funding || null,
      ai_summary: r.description || null,
      last_updated: new Date(),
      created_at: new Date(),
      data_quality_score: 0.8,
      verified: false,
    }))

    return NextResponse.json({ companies })
  } catch (error: any) {
    console.error("[v0] Gemini search error:", error)
    return NextResponse.json(
      { error: error.message || "Search failed", companies: [] },
      { status: 500 }
    )
  }
}
