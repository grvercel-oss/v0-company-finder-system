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

/**
 * Strip markdown code blocks from JSON responses
 */
function extractJSON(content: string): string {
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    return jsonMatch[1].trim()
  }
  return content.trim()
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
    const prompt = `Research the company "${companyName}" and provide a comprehensive business intelligence report.

Create a detailed research report covering:

1. Company Overview: Core business, products/services, mission, and history
2. Industry Position: Market position, main competitors, and competitive advantages
3. Financial Information: Funding rounds, valuation, revenue, and financial performance
4. Recent News & Updates: Latest announcements, partnerships, product launches
5. Key Insights: Strategic analysis, growth trajectory, and important takeaways

${companyDomain ? `Company website: ${companyDomain}` : ""}

Return ONLY a valid JSON object with this structure (no markdown, no code blocks):
{
  "summary": "2-3 sentence executive summary",
  "categories": [
    {
      "category": "Company Overview",
      "content": "Detailed content here with facts and data",
      "sources": ["source url 1", "source url 2"]
    }
  ]
}`

    console.log("[v0] Calling Groq with browser search tool...")

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
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

    console.log("[v0] Parsing response...")

    const cleanContent = extractJSON(content)
    const analysis = JSON.parse(cleanContent)

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
    const prompt = `Search for official corporate registry information for "${companyName}".

${companyDomain ? `Company website: ${companyDomain}` : ""}

Find information from official sources like SEC EDGAR, Companies House, OpenCorporates, etc.

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "company_name": "official registered legal name",
  "registry_name": "name of the registry",
  "registry_url": "URL to the registry website",
  "registration_id": "company number or Not available",
  "date_of_incorporation": "incorporation date or Not available",
  "status": "Active/Dissolved or Not available",
  "directors": [],
  "major_shareholders": [],
  "financials_summary": "summary or Not publicly available",
  "source_url": "direct URL to company page",
  "country": "country code"
}`

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
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
