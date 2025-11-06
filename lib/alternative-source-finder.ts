/**
 * Finds alternative sources for companies with dead domains
 * Uses Tavily to find articles, LinkedIn, Crunchbase, etc.
 */

export interface AlternativeSource {
  url: string
  title: string
  type: "article" | "linkedin" | "crunchbase" | "other"
  description?: string
  researchData?: any // Full Tavily response for caching
}

/**
 * Finds alternative sources for a company using Tavily
 * @param companyName - Name of the company
 * @param deadDomain - The dead domain (for context)
 * @returns Alternative source or null if none found
 */
export async function findAlternativeSource(
  companyName: string,
  deadDomain?: string,
): Promise<AlternativeSource | null> {
  console.log("[v0] Finding alternative source for:", companyName, "- Dead domain:", deadDomain)

  const apiKey = process.env.TAVILY_API_KEY

  if (!apiKey) {
    console.error("[v0] TAVILY_API_KEY not set, cannot find alternative source")
    return null
  }

  try {
    // Search for company information from reliable sources
    const query = `${companyName} company information LinkedIn Crunchbase official`

    console.log("[v0] Tavily alternative source query:", query)

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: true, // Get AI-generated summary
        max_results: 5,
        // Prioritize reliable sources
        include_domains: ["linkedin.com", "crunchbase.com", "bloomberg.com", "forbes.com", "techcrunch.com"],
      }),
    })

    if (!response.ok) {
      console.error("[v0] Tavily API error:", response.status)
      return null
    }

    const data = await response.json()
    const results = data.results || []

    console.log("[v0] Tavily found", results.length, "alternative sources")

    if (results.length === 0) {
      return null
    }

    // Prioritize sources: LinkedIn > Crunchbase > Articles
    const linkedIn = results.find((r: any) => r.url.includes("linkedin.com"))
    const crunchbase = results.find((r: any) => r.url.includes("crunchbase.com"))
    const article = results[0] // First result if no LinkedIn/Crunchbase

    const bestSource = linkedIn || crunchbase || article

    if (!bestSource) {
      return null
    }

    const sourceType = bestSource.url.includes("linkedin.com")
      ? "linkedin"
      : bestSource.url.includes("crunchbase.com")
        ? "crunchbase"
        : bestSource.url.includes("bloomberg.com") ||
            bestSource.url.includes("forbes.com") ||
            bestSource.url.includes("techcrunch.com")
          ? "article"
          : "other"

    console.log("[v0] Selected alternative source:", sourceType, "-", bestSource.url)

    return {
      url: bestSource.url,
      title: bestSource.title,
      type: sourceType,
      description: bestSource.content,
      researchData: data, // Include full Tavily response
    }
  } catch (error: any) {
    console.error("[v0] Error finding alternative source:", error.message)
    return null
  }
}
