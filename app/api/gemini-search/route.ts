import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { getFaviconUrl } from "@/lib/favicon"
import type { Company } from "@/lib/db"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  try {
    const accountId = await getAccountIdFromRequest(request)
    
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
    }

    console.log("[v0] Starting Gemini search for:", query)

    const strictPrompt = `You are a JSON-ONLY API. Return ONLY valid JSON. NO explanations, NO markdown, NO code blocks, NO extra text.

User query: "${query}"

Task:
1. Normalize query: extract industry, region, company count (default 10).
2. Use Google Search grounding to find REAL companies matching the criteria.
3. Return ONLY this JSON array structure (no other text):

[
  {
    "name": "string (required)",
    "domain": "string (domain only, e.g., 'company.com')",
    "website": "string (full URL, e.g., 'https://company.com')",
    "description": "string (brief description)",
    "industry": "string",
    "location": "string (city, country)",
    "employee_count": "string (e.g., '100-500')",
    "founded_year": number,
    "revenue_range": "string (e.g., '$10M-$50M')",
    "funding_stage": "string (e.g., 'Series A')",
    "technologies": ["string"],
    "confidence_score": number (0.0-1.0)
  }
]

CRITICAL:
- Start with [ and end with ]
- NO text before or after the JSON
- Use real company data from search
- If no results: return []

START JSON NOW:`

    const GEMINI_URL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: strictPrompt }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error("[v0] Gemini API error:", JSON.stringify(responseData, null, 2))
      const errorMessage = responseData.error?.message || response.statusText
      throw new Error(`Gemini API error: ${errorMessage}`)
    }

    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rawText) {
      console.error("[v0] No text in Gemini response:", JSON.stringify(responseData, null, 2))
      throw new Error("No response from Gemini")
    }

    console.log("[v0] Raw Gemini response:", rawText.substring(0, 500))

    let parsedResults: any[]
    try {
      let jsonString = rawText.trim()

      // Method 1: Remove markdown code blocks
      jsonString = jsonString.replace(/```json\s*/g, "").replace(/```\s*/g, "")

      // Method 2: Find JSON array boundaries
      const arrayStart = jsonString.indexOf("[")
      const arrayEnd = jsonString.lastIndexOf("]")

      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        jsonString = jsonString.substring(arrayStart, arrayEnd + 1)
      }

      // Try to parse
      parsedResults = JSON.parse(jsonString)

      if (!Array.isArray(parsedResults)) {
        throw new Error("Response is not an array")
      }
    } catch (parseError) {
      console.error("[v0] Failed to parse Gemini response:", rawText)
      console.error("[v0] Parse error:", parseError)
      throw new Error("Failed to parse company data from Gemini")
    }

    console.log("[v0] Successfully parsed", parsedResults.length, "companies from Gemini")

    const savedCompanies: Company[] = []

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

        savedCompanies.push(inserted[0])
        console.log("[v0] Saved company:", company.name)
      } catch (dbError: any) {
        console.error("[v0] Error saving company:", company.name, dbError.message)
      }
    }

    try {
      await sql`
        INSERT INTO search_history (query, results_count, search_timestamp)
        VALUES (${query}, ${savedCompanies.length}, NOW())
      `
    } catch (historyError) {
      console.error("[v0] Error saving search history:", historyError)
    }

    console.log("[v0] Gemini search completed:", savedCompanies.length, "companies saved")

    return NextResponse.json({
      success: true,
      companies: savedCompanies,
      count: savedCompanies.length,
    })
  } catch (error: any) {
    console.error("[v0] Gemini search error:", error)
    return NextResponse.json({ error: error.message || "Search failed", companies: [] }, { status: 500 })
  }
}
