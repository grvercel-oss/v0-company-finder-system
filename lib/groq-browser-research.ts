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
    // Use Groq's browser search tool to research the company
    const prompt = `Research the company "${companyName}" and provide a comprehensive business intelligence report.

Create a detailed research report covering:

1. **Company Overview**: Core business, products/services, mission, and history
2. **Industry Position**: Market position, main competitors, and competitive advantages
3. **Financial Information**: Funding rounds, valuation, revenue, and financial performance
4. **Recent News & Updates**: Latest announcements, partnerships, product launches (especially 2025)
5. **Key Insights**: Strategic analysis, growth trajectory, and important takeaways

${companyDomain ? `Company website: ${companyDomain}` : ""}

Return the response as a JSON object with this structure:
{
  "summary": "2-3 sentence executive summary",
  "categories": [
    {
      "category": "Company Overview",
      "content": "Detailed content here with facts and data",
      "sources": ["source url 1", "source url 2"]
    },
    {
      "category": "Industry Position", 
      "content": "Detailed content here with market analysis",
      "sources": ["source url 1", "source url 2"]
    },
    {
      "category": "Financial Information",
      "content": "Funding, valuation, revenue details",
      "sources": ["source url 1", "source url 2"]
    },
    {
      "category": "Recent News & Updates",
      "content": "Latest developments and announcements",
      "sources": ["source url 1", "source url 2"]
    },
    {
      "category": "Key Insights",
      "content": "Strategic analysis and important takeaways",
      "sources": ["source url 1", "source url 2"]
    }
  ]
}

Focus on factual, current information. Include specific data points, dates, and numbers where available. Cite your sources.`

    console.log("[v0] Calling Groq with browser search tool...")

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content:
            "You are a business intelligence analyst. Research companies using web search and provide comprehensive, factual reports. Always return valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      tool_choice: "required",
      tools: [
        {
          type: "browser_search",
        },
      ],
    })

    const content = completion.choices[0]?.message?.content || "{}"
    console.log("[v0] Received response from Groq")

    const cleanContent = extractJSON(content)
    const analysis = JSON.parse(cleanContent)

    // Fetch registry data in parallel
    console.log("[v0] Fetching corporate registry data...")
    const registryData = await fetchRegistryData(companyName, companyDomain)

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

    // Return basic structure if research fails
    return {
      companyName,
      summary: `Research for ${companyName} encountered an error. Please try again.`,
      categories: [
        {
          category: "Error",
          content: error instanceof Error ? error.message : "Research failed",
          sources: [],
        },
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Fetch corporate registry data using browser search
 */
async function fetchRegistryData(companyName: string, companyDomain?: string): Promise<CorporateRegistryData | null> {
  console.log("[v0] Fetching registry data for:", companyName)

  try {
    const prompt = `Search for official corporate registry information for "${companyName}".

${companyDomain ? `Company website: ${companyDomain}` : ""}

Find information from official sources like:
- SEC EDGAR (US)
- Companies House (UK)
- OpenCorporates (International)
- ASIC (Australia)
- ACRA (Singapore)
- Other official corporate registries

Extract and return ONLY this JSON object:
{
  "company_name": "official registered legal name",
  "registry_name": "name of the registry (e.g., SEC EDGAR, Companies House)",
  "registry_url": "URL to the registry website",
  "registration_id": "company/registration number if found",
  "date_of_incorporation": "incorporation date if found, or 'Not available'",
  "status": "company status (Active/Dissolved) or 'Not available'",
  "directors": ["list of directors/officers if publicly available"],
  "major_shareholders": ["list of major shareholders if publicly available"],
  "financials_summary": "brief summary of recent financial filings or 'Not publicly available'",
  "source_url": "direct URL to the company's registry page",
  "country": "country code (US, UK, SG, AU, etc.)"
}

If information is not found, use "Not available" for strings or empty arrays for lists.`

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: "Extract corporate registry information from official sources. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1024,
      tool_choice: "required",
      tools: [
        {
          type: "browser_search",
        },
      ],
    })

    const content = completion.choices[0]?.message?.content || "{}"
    const cleanContent = extractJSON(content)
    const registryData = JSON.parse(cleanContent)

    console.log("[v0] Successfully extracted registry data")

    return registryData
  } catch (error) {
    console.error("[v0] Error fetching registry data:", error)
    return null
  }
}
