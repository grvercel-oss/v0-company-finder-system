import type { SearchWorker, SearchWorkerResult, ICP, CompanyResult } from "../types"

export class CrunchbaseSearchWorker implements SearchWorker {
  name = "Crunchbase"
  timeout = 15000 // 15 seconds

  async search(queries: string[], icp: ICP): Promise<SearchWorkerResult> {
    const startTime = Date.now()
    console.log("[v0] [Crunchbase] Starting search")

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const query = queries[0] || "companies"

      const systemPrompt = `You are a Crunchbase expert. Your task is to find funded startups and companies that would have profiles on Crunchbase.

Focus ONLY on Crunchbase as your source. Think about what companies would be listed on Crunchbase with funding information, investor details, and company metrics.

Crunchbase specializes in: funded startups, venture-backed companies, acquisition data, funding rounds, etc.`

      const userPrompt = `Find 10 funded companies on Crunchbase that match: "${query}"

Based on the ICP:
- Industries: ${icp.industries.join(", ")}
- Locations: ${icp.locations.join(", ")}
- Funding stages: ${icp.funding_stages?.join(", ") || "various"}

Return a JSON array with this structure:
[
  {
    "name": "Company Name",
    "website": "https://example.com",
    "location": "City, Country",
    "category": "Industry",
    "funding_stage": "Seed/Series A/etc",
    "total_funding": "$5M",
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
          model: "gpt-4.1",
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

      console.log("[v0] [Crunchbase] Found", companies.length, "companies in", duration, "ms")

      return {
        companies,
        source: this.name,
        duration_ms: duration,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error("[v0] [Crunchbase] Error:", error.message)

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
          funding_stage: c.funding_stage || "",
          source: this.name,
          confidence_score: 0.85,
        }))
      }

      return []
    } catch (error) {
      console.error("[v0] [Crunchbase] Parse error:", error)
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
