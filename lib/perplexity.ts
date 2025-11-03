// Perplexity API client for company search
export interface PerplexitySearchResult {
  answer: string
  citations: string[]
  companies: Array<{
    name: string
    domain?: string
    description?: string
    industry?: string
    location?: string
    website?: string
  }>
  usage?: {
    input_tokens: number
    output_tokens: number
    cost: number
  }
}

export async function searchCompaniesWithPerplexity(
  query: string,
  filters?: {
    industry?: string
    location?: string
    size?: string
  },
): Promise<PerplexitySearchResult> {
  console.log("[v0] Starting Perplexity search with query:", query)
  console.log("[v0] Filters:", filters)

  const apiKey = process.env.PERPLEXITY_API_KEY

  if (!apiKey) {
    console.error("[v0] PERPLEXITY_API_KEY is not configured")
    throw new Error("PERPLEXITY_API_KEY is not configured")
  }

  console.log("[v0] Perplexity API key found, length:", apiKey.length)

  // Build enhanced query with filters
  let enhancedQuery = query
  if (filters?.industry) {
    enhancedQuery += ` in ${filters.industry} industry`
  }
  if (filters?.location) {
    enhancedQuery += ` located in ${filters.location}`
  }
  if (filters?.size) {
    enhancedQuery += ` company size ${filters.size}`
  }

  console.log("[v0] Enhanced query:", enhancedQuery)

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a business intelligence assistant that searches the internet for company information. You MUST respond with valid JSON only, no additional text. Return an array of exactly 5 companies with their details.",
          },
          {
            role: "user",
            content: `Search the internet and find exactly 5 companies that match: "${enhancedQuery}". 

For each company, provide accurate information from the web including:
- name (company name)
- domain (main domain without www, e.g., "example.com")
- description (brief description of what they do)
- industry (their primary industry)
- location (headquarters location)
- website (full website URL)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "name": "Company Name",
    "domain": "example.com",
    "description": "What the company does",
    "industry": "Industry name",
    "location": "City, Country",
    "website": "https://example.com"
  }
]

Return exactly 5 companies. Use real, current information from the internet.`,
          },
        ],
        temperature: 0.2,
        return_citations: true,
      }),
    })

    console.log("[v0] Perplexity API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Perplexity API error response:", errorText)
      throw new Error(`Perplexity API error: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log("[v0] Perplexity API response received, choices:", data.choices?.length)

    // Parse the response to extract company information
    const answer = data.choices[0].message.content
    const citations = data.citations || []

    console.log("[v0] Answer length:", answer.length)
    console.log("[v0] Citations count:", citations.length)
    console.log("[v0] Raw answer:", answer)

    const usage = data.usage || {}
    const inputTokens = usage.prompt_tokens || 0
    const outputTokens = usage.completion_tokens || 0

    // Perplexity Sonar Pro pricing: $3 per 1M input tokens, $15 per 1M output tokens
    const inputCost = (inputTokens / 1_000_000) * 3
    const outputCost = (outputTokens / 1_000_000) * 15
    const totalCost = inputCost + outputCost

    console.log("[v0] Perplexity usage - Input tokens:", inputTokens, "Output tokens:", outputTokens)
    console.log("[v0] Perplexity cost: $", totalCost.toFixed(6))

    // Extract company data from the response
    const companies = parseCompaniesFromResponse(answer)
    console.log("[v0] Parsed companies count:", companies.length)
    console.log("[v0] Parsed companies:", JSON.stringify(companies, null, 2))

    return {
      answer,
      citations,
      companies,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost: totalCost,
      },
    }
  } catch (error: any) {
    console.error("[v0] Perplexity search error:", error.message)
    console.error("[v0] Error stack:", error.stack)
    throw error
  }
}

function parseCompaniesFromResponse(text: string): Array<{
  name: string
  domain?: string
  description?: string
  industry?: string
  location?: string
  website?: string
}> {
  console.log("[v0] Starting to parse companies from response")

  try {
    // Try to extract JSON from the response
    // Sometimes the AI wraps JSON in markdown code blocks
    let jsonText = text.trim()

    // Remove markdown code blocks if present
    if (jsonText.includes("```json")) {
      const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
      if (match) {
        jsonText = match[1].trim()
      }
    } else if (jsonText.includes("```")) {
      const match = jsonText.match(/```\s*([\s\S]*?)\s*```/)
      if (match) {
        jsonText = match[1].trim()
      }
    }

    // Try to find JSON array in the text
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      jsonText = arrayMatch[0]
    }

    console.log("[v0] Extracted JSON text:", jsonText.substring(0, 200))

    const parsed = JSON.parse(jsonText)
    console.log("[v0] Successfully parsed JSON, type:", Array.isArray(parsed) ? "array" : typeof parsed)

    if (Array.isArray(parsed)) {
      console.log("[v0] Found", parsed.length, "companies in array")
      return parsed.map((company: any) => ({
        name: company.name || "",
        domain: company.domain || extractDomain(company.website || ""),
        description: company.description || "",
        industry: company.industry || "",
        location: company.location || "",
        website: company.website || "",
      }))
    }

    console.log("[v0] Parsed data is not an array, returning empty")
    return []
  } catch (error: any) {
    console.error("[v0] Failed to parse JSON from response:", error.message)
    console.log("[v0] Attempting fallback parsing...")

    // Fallback: try to extract company information from natural language
    return fallbackParseCompanies(text)
  }
}

function fallbackParseCompanies(text: string): Array<{
  name: string
  domain?: string
  description?: string
  industry?: string
  location?: string
  website?: string
}> {
  console.log("[v0] Using fallback parsing method")
  const companies: Array<any> = []

  // Split by common delimiters that might separate companies
  const sections = text.split(/\n\n+|\d+\.\s+/)

  for (const section of sections) {
    if (section.trim().length < 20) continue // Skip very short sections

    const company: any = {}
    const lines = section.split("\n")

    for (const line of lines) {
      const lowerLine = line.toLowerCase()

      if ((lowerLine.includes("name:") || lowerLine.includes("company:")) && !company.name) {
        company.name = line.split(":").slice(1).join(":").trim()
      } else if (lowerLine.includes("website:") || lowerLine.includes("url:")) {
        const url = line.split(":").slice(1).join(":").trim()
        company.website = url
        company.domain = extractDomain(url)
      } else if (lowerLine.includes("domain:") && !company.domain) {
        company.domain = line.split(":").slice(1).join(":").trim()
      } else if (lowerLine.includes("industry:") && !company.industry) {
        company.industry = line.split(":").slice(1).join(":").trim()
      } else if (lowerLine.includes("location:") && !company.location) {
        company.location = line.split(":").slice(1).join(":").trim()
      } else if (lowerLine.includes("description:") && !company.description) {
        company.description = line.split(":").slice(1).join(":").trim()
      } else if (!company.name && line.trim().length > 0 && !line.includes(":")) {
        // First non-empty line without colon might be the company name
        company.name = line.trim()
      }
    }

    if (company.name) {
      companies.push(company)
      console.log("[v0] Fallback parsed company:", company.name)
    }

    if (companies.length >= 5) break // Limit to 5 companies
  }

  console.log("[v0] Fallback parsing found", companies.length, "companies")
  return companies
}

function extractDomain(url: string): string {
  if (!url) return ""
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`)
    return urlObj.hostname.replace("www.", "")
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/\s]+)/)
    return match ? match[1] : url
  }
}
