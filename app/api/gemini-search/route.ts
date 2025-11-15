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

    const prompt = `Find 10 real companies matching: "${query}". Return ONLY valid JSON array:
[{"name":"Company","industry":"Tech","location":"City, Country","employees":100,"founded":2020,"revenue":"$10M","funding":"$5M","description":"Brief description","website":"https://example.com"}]`

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search_retrieval: { dynamic_retrieval_config: { mode: "MODE_DYNAMIC" } } }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.3 },
      }),
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error("No response from Gemini")
    }

    const results = JSON.parse(text)
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
    return NextResponse.json({ error: error.message || "Search failed", companies: [] }, { status: 500 })
  }
}
