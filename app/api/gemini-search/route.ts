import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getFaviconUrl } from "@/lib/favicon"
import type { Company } from "@/lib/db"

export const runtime = "edge"
export const maxDuration = 60 // Increased timeout for grounded search

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      console.error("[v0] GEMINI_API_KEY not found in environment variables")
      return NextResponse.json(
        { error: "Gemini API key not configured. Please add GEMINI_API_KEY to environment variables." },
        { status: 500 }
      )
    }

    console.log("[v0] Starting Gemini search for:", query)

    const prompt = `Find companies matching this search: "${query}"

Return ONLY a valid JSON array with this EXACT structure (no markdown, no explanations):
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
    "technologies": ["Tech1", "Tech2"],
    "confidence_score": 0.85,
    "investors": [
      {
        "investor_name": "VC Fund Name",
        "investor_type": "VC",
        "investor_website": "https://vcfund.com",
        "investment_amount": "$10M",
        "investment_round": "Series A",
        "investment_date": "2023-05-15",
        "investment_year": 2023
      }
    ]
  }
]

Find ${query.toLowerCase().includes('find') ? '' : '10'} real companies. Include all investors you can find for each company.`

    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        tools: [
          {
            google_search: {}, // Correct tool structure for Gemini 2.5 Flash
          },
        ],
        generationConfig: {
          temperature: 0.1, // Lower temperature for more consistent JSON
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[v0] Gemini API error:", errorData)
      throw new Error(errorData.error?.message || `Gemini API error: ${response.statusText}`)
    }

    const responseData = await response.json()
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rawText) {
      console.error("[v0] No text in Gemini response")
      throw new Error("No response from Gemini")
    }

    console.log("[v0] Raw Gemini response length:", rawText.length)

    let parsedResults: any[]
    try {
      let jsonString = rawText.trim()

      // Remove markdown code blocks
      jsonString = jsonString.replace(/```json\s*/g, "").replace(/```\s*/g, "")

      // Extract JSON array
      const arrayStart = jsonString.indexOf("[")
      const arrayEnd = jsonString.lastIndexOf("]")

      if (arrayStart === -1 || arrayEnd === -1) {
        throw new Error("No JSON array found in response")
      }

      jsonString = jsonString.substring(arrayStart, arrayEnd + 1)

      // Clean up invalid JSON patterns
      jsonString = jsonString
        .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
        .replace(/(\d{4})\s*$$[^)]+$$[^,}\]]*/g, "$1") // Fix year with parentheses
        .replace(/\n/g, " ") // Remove newlines
        .replace(/\s+/g, " ") // Normalize whitespace

      parsedResults = JSON.parse(jsonString)

      if (!Array.isArray(parsedResults)) {
        throw new Error("Parsed result is not an array")
      }
    } catch (parseError: any) {
      console.error("[v0] Failed to parse JSON:", parseError.message)
      console.error("[v0] Raw text:", rawText.substring(0, 1000))
      return NextResponse.json(
        { error: "Failed to parse results from AI", companies: [] },
        { status: 500 }
      )
    }

    console.log("[v0] Parsed", parsedResults.length, "companies")

    const savedCompanies: Company[] = []

    for (const company of parsedResults) {
      try {
        if (!company.name) continue

        const domain = company.domain || company.name.toLowerCase().replace(/\s+/g, "") + ".com"
        const website = company.website || `https://${domain}`
        const faviconUrl = getFaviconUrl(website)

        // Insert company
        const [savedCompany] = await sql`
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
            last_updated = NOW()
          RETURNING *
        `

        // Insert investors
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
                ${savedCompany.id},
                ${investor.investor_name},
                ${investor.investor_type || null},
                ${investor.investor_website || null},
                ${investor.investment_amount || null},
                ${investor.investment_round || null},
                ${investor.investment_date || null},
                ${investor.investment_year || null},
                'Gemini Search',
                ${company.confidence_score || 0.7}
              )
              ON CONFLICT (company_id, investor_name, investment_round) DO UPDATE SET
                investor_type = COALESCE(EXCLUDED.investor_type, investors.investor_type),
                investor_website = COALESCE(EXCLUDED.investor_website, investors.investor_website),
                investment_amount = COALESCE(EXCLUDED.investment_amount, investors.investment_amount),
                updated_at = NOW()
              RETURNING *
            `
            savedInvestors.push(savedInvestor)
          } catch (err: any) {
            console.error("[v0] Error saving investor:", investor.investor_name, err.message)
          }
        }

        savedCompany.investors = savedInvestors
        savedCompanies.push(savedCompany)
        console.log("[v0] Saved:", company.name, "with", savedInvestors.length, "investors")
      } catch (err: any) {
        console.error("[v0] Error saving company:", company.name, err.message)
      }
    }

    // Save search history
    try {
      await sql`
        INSERT INTO search_history (query, results_count, search_timestamp)
        VALUES (${query}, ${savedCompanies.length}, NOW())
      `
    } catch (err) {
      console.error("[v0] Error saving search history:", err)
    }

    console.log("[v0] Search complete:", savedCompanies.length, "companies saved")

    return NextResponse.json({
      success: true,
      companies: savedCompanies,
      count: savedCompanies.length,
    })
  } catch (error: any) {
    console.error("[v0] Gemini search error:", error.message)
    return NextResponse.json(
      { error: error.message || "Search failed", companies: [] },
      { status: 500 }
    )
  }
}
