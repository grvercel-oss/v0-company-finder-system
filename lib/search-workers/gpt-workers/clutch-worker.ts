import type { SearchWorker, SearchWorkerResult, ICP, CompanyResult } from "../types"

export class ClutchSearchWorker implements SearchWorker {
  name = "Clutch"
  timeout = 60000 // Increased to 60 seconds for multiple API calls

  async search(queries: string[], icp: ICP, desiredCount = 10): Promise<SearchWorkerResult> {
    const startTime = Date.now()
    console.log(`[v0] [Clutch] Starting search for ${desiredCount} companies`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const query = queries[0] || "companies"

      const allCompanies: CompanyResult[] = []
      const companiesPerCall = 20
      const maxCalls = Math.ceil(desiredCount / companiesPerCall)

      console.log(`[v0] [Clutch] Will make ${maxCalls} API calls to get ${desiredCount} companies`)

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        const remainingCount = desiredCount - allCompanies.length
        const countForThisCall = Math.min(companiesPerCall, remainingCount)

        if (countForThisCall <= 0) break

        console.log(`[v0] [Clutch] API call ${callIndex + 1}/${maxCalls}, requesting ${countForThisCall} companies`)

        const systemPrompt = `You are a Clutch.co expert. Your task is to find B2B service companies that would be listed on Clutch.co.

Focus ONLY on Clutch.co as your source. Think about what companies would have profiles on Clutch with client reviews and ratings.

Clutch specializes in: software development, marketing agencies, design firms, IT services, consulting, etc.

IMPORTANT: Return DIFFERENT companies each time. Avoid duplicates from previous searches.`

        const userPrompt = `Find ${countForThisCall} B2B service companies on Clutch.co that match: "${query}"

Based on the ICP:
- Industries: ${icp.industries.join(", ")}
- Locations: ${icp.locations.join(", ")}
- Company sizes: ${icp.company_sizes.join(", ")}

${allCompanies.length > 0 ? `AVOID these companies already found: ${allCompanies.map((c) => c.name).join(", ")}` : ""}

Return a JSON array with this structure:
[
  {
    "name": "Company Name",
    "website": "https://example.com",
    "location": "City, Country",
    "category": "Service Category",
    "employee_count": "10-50",
    "description": "Brief description of services"
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
            temperature: 0.7, // Increased temperature for more variety
          }),
        })

        if (!response.ok) {
          console.error(`[v0] [Clutch] API error on call ${callIndex + 1}: ${response.statusText}`)
          break
        }

        const data = await response.json()
        const answer = data.choices[0].message.content

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [Clutch] Call ${callIndex + 1} returned ${companies.length} companies`)

        allCompanies.push(...companies)

        if (allCompanies.length >= desiredCount) {
          break
        }
      }

      const duration = Date.now() - startTime
      console.log(`[v0] [Clutch] Found ${allCompanies.length} total companies in ${duration} ms`)

      return {
        companies: allCompanies.slice(0, desiredCount),
        source: this.name,
        duration_ms: duration,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error("[v0] [Clutch] Error:", error.message)

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
          confidence_score: 0.8,
        }))
      }

      return []
    } catch (error) {
      console.error("[v0] [Clutch] Parse error:", error)
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
