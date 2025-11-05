// Perplexity Worker - refactored from existing perplexity.ts

import type { SearchWorker, SearchWorkerResult, ICP, CompanyResult } from "./types"

export class PerplexityWorker implements SearchWorker {
  name = "Perplexity"
  timeout = 60000 // 60 seconds

  async search(queries: string[], icp: ICP): Promise<SearchWorkerResult> {
    const startTime = Date.now()
    console.log("[v0] [Perplexity] Starting search with", queries.length, "queries")

    try {
      const apiKey = process.env.PERPLEXITY_API_KEY
      if (!apiKey) {
        throw new Error("PERPLEXITY_API_KEY not configured")
      }

      // Use the first 2 queries for Perplexity
      const searchQueries = queries.slice(0, 2)
      const allCompanies: CompanyResult[] = []

      for (const query of searchQueries) {
        console.log("[v0] [Perplexity] Searching:", query)

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
                  "You are a business intelligence assistant. Search the internet and return company information in JSON format only.",
              },
              {
                role: "user",
                content: `Find 5 companies matching: "${query}". Return JSON array with: name, domain, description, industry, location, website, employee_count, revenue_range, funding_stage, technologies (array).`,
              },
            ],
            temperature: 0.2,
          }),
        })

        if (!response.ok) {
          console.error("[v0] [Perplexity] API error:", response.statusText)
          continue
        }

        const data = await response.json()
        const answer = data.choices[0].message.content

        const companies = this.parseCompanies(answer)
        allCompanies.push(...companies)

        console.log("[v0] [Perplexity] Found", companies.length, "companies from query")
      }

      const duration = Date.now() - startTime
      console.log("[v0] [Perplexity] Completed in", duration, "ms with", allCompanies.length, "companies")

      return {
        companies: allCompanies,
        source: this.name,
        duration_ms: duration,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error("[v0] [Perplexity] Error:", error.message)

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

      // Remove markdown code blocks
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
          domain: c.domain || this.extractDomain(c.website || ""),
          description: c.description || "",
          industry: c.industry || "",
          location: c.location || "",
          website: c.website || "",
          employee_count: c.employee_count || "",
          revenue_range: c.revenue_range || "",
          funding_stage: c.funding_stage || "",
          technologies: c.technologies || [],
          source: this.name,
          confidence_score: 0.8,
        }))
      }

      return []
    } catch (error) {
      console.error("[v0] [Perplexity] Parse error:", error)
      return []
    }
  }

  private extractDomain(url: string): string {
    if (!url) return ""
    try {
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`)
      return urlObj.hostname.replace("www.", "")
    } catch {
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/\s]+)/)
      return match ? match[1] : url
    }
  }
}
