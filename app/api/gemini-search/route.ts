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
3. For EACH company, also search for their investors and funding information.
4. Return ONLY this JSON array structure (no other text):

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

CRITICAL:
- Start with [ and end with ]
- NO text before or after the JSON
- Use real company AND investor data from search
- Include as many investors as you can find for each company
- If no investors found for a company: set "investors": []
- If no companies found: return []

START JSON NOW:`

    const GEMINI_URL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

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
          maxOutputTokens: 8192, // Increased for investor data
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
      jsonString = jsonString.replace(/\`\`\`json\s*/g, "").replace(/\`\`\`\s*/g, "")

      // Method 2: Find JSON array boundaries
      const arrayStart = jsonString.indexOf("[")
      const arrayEnd = jsonString.lastIndexOf("]")

      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        jsonString = jsonString.substring(arrayStart, arrayEnd + 1)
      }

      // Method 3: Sanitize common JSON issues from LLM responses
      // Fix trailing commas in arrays and objects
      jsonString = jsonString.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}")
      
      // Fix invalid number fields with text (e.g., "2018 (Ubigi brand), 2000 (Transatel)")
      // Match patterns like: "field": number (text), number, or "field": number (text)
      jsonString = jsonString.replace(
        /"founded_year":\s*(\d{4})\s*$$[^)]+$$[^,}]*/g,
        '"founded_year": $1'
      )
      
      // Remove any remaining parenthetical notes in number fields
      jsonString = jsonString.replace(
        /("(?:founded_year|investment_year|employee_count)":\s*\d+)\s*$$[^)]+$$/g,
        "$1"
      )

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
          } catch (investorError: any) {
            console.error("[v0] Error saving investor:", investor.investor_name, investorError.message)
          }
        }

        savedCompany.investors = savedInvestors
        savedCompanies.push(savedCompany)
        
        console.log("[v0] Saved company:", company.name, "with", savedInvestors.length, "investors")
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
