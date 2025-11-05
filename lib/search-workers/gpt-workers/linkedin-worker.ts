import type { SearchWorker, SearchWorkerResult, ICP, CompanyResult } from "../types"

export class LinkedInSearchWorker implements SearchWorker {
  name = "LinkedIn"
  timeout = 30000 // 30 seconds

  async search(queries: string[], icp: ICP, desiredCount = 10): Promise<SearchWorkerResult> {
    const startTime = Date.now()
    console.log("[v0] [LinkedIn] Starting search")

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const query = queries[0] || "companies"

      const systemPrompt = `You are a LinkedIn company search expert. Your task is to find real companies that would appear on LinkedIn based on the search query.

Focus ONLY on LinkedIn as your source. Simulate what you would find by searching LinkedIn's company directory.

Return specialized companies, startups, and focused providers - NOT large generic corporations unless they're the primary players in this specific niche.`

      const userPrompt = `Find ${desiredCount} companies on LinkedIn that match: "${query}"

Based on the ICP:
- Industries: ${icp.industries.join(", ")}
- Locations: ${icp.locations.join(", ")}
- Company sizes: ${icp.company_sizes.join(", ")}

Return a JSON array with this structure:
[
  {
    "name": "Company Name",
    "website": "https://example.com",
    "location": "City, Country",
    "category": "Industry/Category",
    "employee_count": "10-50",
    "description": "Brief description"
  }
]

Return ONLY the JSON array, no other text.`

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()
      const answer = data.choices[0].message.content

      const companies = this.parseCompanies(answer)
      const duration = Date.now() - startTime

      console.log("[v0] [LinkedIn] Found", companies.length, "companies in", duration, "ms")

      return {
        companies,
        source: this.name,
        duration_ms: duration,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error("[v0] [LinkedIn] Error:", error.message)

      return {
        companies: [],
        source: this.name,
        duration_ms: duration,
        error: error.message,
      }
    }
  }

  private parseCompanies(text: string): CompanyResult[] {
    try {
      let jsonText = text.trim()

      if (jsonText.includes("```json")) {
        const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
        if (match) jsonText = match[1].trim()
      } else if (jsonText.includes("```")) {
        const match = jsonText.match(/```\s*([\s\S]*?)\s*```/)
        if (match) jsonText = match[1].trim()
      }

      const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
      if (arrayMatch) jsonText = arrayMatch[0]

      const parsed = JSON.parse(jsonText)

      if (Array.isArray(parsed)) {
        return parsed.map((c: any) => ({
          name: c.name || "",
          domain: this.extractDomain(c.website || ""),
          description: c.description || "",
          industry: c.category || "",
          location: c.location || "",
          website: c.website || "",
          employee_count: c.employee_count || "",
          source: this.name,
          confidence_score: 0.75,
        }))
      }

      return []
    } catch (error) {
      console.error("[v0] [LinkedIn] Parse error:", error)
      return []
    }
  }

  private extractDomain(url: string): string {
    if (!url) return ""
    try {
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`)
      return urlObj.hostname.replace("www.", "")
    } catch {
      return url
    }
  }
}
