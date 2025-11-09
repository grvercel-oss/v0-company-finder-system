// Research system using Groq GPT OSS 20B with built-in browser search tool
// Much cheaper than Brave Search API - browser search is FREE during promotional period!

import Groq from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.API_KEY_GROQ_API_KEY,
})

export interface CorporateRegistryData {
  company_name: string
  registry_name: string
  registry_url: string
  registration_id: string
  date_of_incorporation: string
  status: string
  directors: string[]
  major_shareholders: string[]
  financials_summary: string
  source_url: string
  country: string
}

export interface CompanyResearchData {
  companyName: string
  summary: string
  categories: Array<{
    category: string
    content: string
    sources: string[]
  }>
  generatedAt: string
  registryData?: CorporateRegistryData | null
}

function extractJSON(content: string): string {
  // Remove markdown code blocks
  let cleaned = content.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, "$1")

  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim()

  // Find JSON object boundaries
  const startIdx = cleaned.indexOf("{")
  const endIdx = cleaned.lastIndexOf("}")

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1)
  }

  return cleaned
}

function sanitizeForJSON(text: string): string {
  // Replace problematic characters
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"') // Escape quotes
    .trim()
}

/**
 * Research company using Groq GPT OSS 20B with built-in browser search
 */
export async function researchCompanyWithGroqBrowser(
  companyName: string,
  companyDomain?: string,
): Promise<CompanyResearchData> {
  console.log("[v0] Starting Groq browser search research for:", companyName)

  try {
    const prompt = `Research "${companyName}" and provide business intelligence. ${companyDomain ? `Website: ${companyDomain}` : ""}

Respond with ONLY this JSON structure (no markdown, no extra text):
{
  "summary": "brief 2-3 sentence summary",
  "categories": [
    {"category": "Overview", "content": "business details", "sources": ["url1"]},
    {"category": "Market Position", "content": "industry standing", "sources": ["url2"]},
    {"category": "Financial Info", "content": "funding and revenue", "sources": ["url3"]},
    {"category": "Recent News", "content": "latest updates", "sources": ["url4"]}
  ]
}`

    console.log("[v0] Calling Groq with browser search tool...")

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content:
            "You are a business research assistant. Always respond with valid JSON only. Never include markdown formatting or explanatory text outside the JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4096,
      tools: [
        {
          type: "browser_search",
        },
      ],
      tool_choice: "auto",
    })

    console.log("[v0] Response received from Groq")

    const content = completion.choices[0]?.message?.content

    if (!content) {
      throw new Error("No content received from Groq")
    }

    console.log("[v0] Raw content length:", content.length)
    console.log("[v0] First 200 chars:", content.substring(0, 200))

    const cleanContent = extractJSON(content)
    console.log("[v0] Cleaned content length:", cleanContent.length)

    let analysis
    try {
      analysis = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error("[v0] JSON parse error:", parseError)
      console.error("[v0] Failed content:", cleanContent.substring(0, 500))
      throw new Error(
        `Failed to parse Groq response as JSON: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`,
      )
    }

    console.log("[v0] Fetching corporate registry data...")
    const registryData = await fetchRegistryData(companyName, companyDomain).catch((err) => {
      console.error("[v0] Registry data fetch failed:", err)
      return null
    })

    console.log("[v0] Research completed successfully")

    return {
      companyName,
      summary: analysis.summary || `Comprehensive research for ${companyName}`,
      categories: analysis.categories || [],
      generatedAt: new Date().toISOString(),
      registryData,
    }
  } catch (error) {
    console.error("[v0] Error in Groq browser research:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    console.error("[v0] Full error details:", error)

    return {
      companyName,
      summary: `Research for ${companyName} encountered an error: ${errorMessage}`,
      categories: [
        {
          category: "Error Details",
          content: `The research system encountered an error while processing ${companyName}. Error: ${errorMessage}. Please try again or contact support if the issue persists.`,
          sources: [],
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}

async function fetchRegistryData(companyName: string, companyDomain?: string): Promise<CorporateRegistryData | null> {
  console.log("[v0] Fetching registry data for:", companyName)

  try {
    const prompt = `Find official corporate registry info for "${companyName}". ${companyDomain ? `Website: ${companyDomain}` : ""}

Respond with ONLY this JSON (no markdown):
{
  "company_name": "legal name",
  "registry_name": "registry name or Not available",
  "registry_url": "url or Not available",
  "registration_id": "id or Not available",
  "date_of_incorporation": "date or Not available",
  "status": "Active or Not available",
  "directors": [],
  "major_shareholders": [],
  "financials_summary": "summary or Not available",
  "source_url": "url or Not available",
  "country": "country or Not available"
}`

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: "You are a corporate registry research assistant. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      tools: [
        {
          type: "browser_search",
        },
      ],
      tool_choice: "auto",
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      console.log("[v0] No registry content received")
      return null
    }

    const cleanContent = extractJSON(content)
    const registryData = JSON.parse(cleanContent)

    console.log("[v0] Successfully extracted registry data")

    return registryData
  } catch (error) {
    console.error("[v0] Error fetching registry data:", error)
    return null
  }
}
