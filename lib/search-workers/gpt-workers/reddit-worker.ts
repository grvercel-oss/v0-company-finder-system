import type { SearchWorkerResult, ICP, CompanyResult, ProgressiveSearchWorker } from "../types"
import { filterCompaniesByDomain } from "@/lib/domain-verifier"

export class RedditSearchWorker implements ProgressiveSearchWorker {
  name = "Reddit"
  timeout = 150000

  async *searchProgressive(query: string, desiredCount = 10): AsyncGenerator<CompanyResult[], void, unknown> {
    console.log(`[v0] [Reddit] Starting progressive search for ${desiredCount} companies`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const allCompanies: CompanyResult[] = []
      const companiesPerCall = 10
      const maxCalls = Math.ceil(desiredCount / companiesPerCall)

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        const remainingCount = desiredCount - allCompanies.length
        const countForThisCall = Math.min(companiesPerCall, remainingCount)

        if (countForThisCall <= 0) break

        console.log(`[v0] [Reddit] API call ${callIndex + 1}/${maxCalls}, requesting ${countForThisCall} companies`)

        const systemPrompt = `You are a Reddit community expert. Your task is to find companies that are frequently discussed, recommended, or mentioned on Reddit communities.

Focus ONLY on Reddit as your source. Think about what companies would be mentioned in subreddits like r/startups, r/entrepreneur, r/technology, or industry-specific subreddits.

Return companies that have active Reddit presence or are frequently recommended by Reddit users.

IMPORTANT: Return DIFFERENT companies each time. Avoid duplicates from previous searches.`

        const userPrompt = `Find ${countForThisCall} companies frequently mentioned on Reddit that match: "${query}"

${allCompanies.length > 0 ? `AVOID these companies already found: ${allCompanies.map((c) => c.name).join(", ")}` : ""}

Return a JSON array with this structure:
[
  {
    "name": "Company Name",
    "website": "https://example.com",
    "location": "City, Country",
    "category": "Industry/Category",
    "description": "Brief description and why Reddit users recommend them"
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
            temperature: 0.7,
          }),
        })

        if (!response.ok) {
          console.error(`[v0] [Reddit] API error on call ${callIndex + 1}: ${response.statusText}`)
          break
        }

        const data = await response.json()

        const usage = data.usage
        if (usage) {
          console.log(`[v0] [Reddit] Token usage - Input: ${usage.prompt_tokens}, Output: ${usage.completion_tokens}`)
        }

        const answer = data.choices[0].message.content

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [Reddit] Call ${callIndex + 1} returned ${companies.length} companies`)

        if (companies.length > 0) {
          const { verified, rejected } = await filterCompaniesByDomain(companies)
          console.log(`[v0] [Reddit] Verified ${verified.length}/${companies.length} companies`)

          if (verified.length > 0) {
            allCompanies.push(...verified)
            yield verified
          }
        }

        if (allCompanies.length >= desiredCount) {
          break
        }
      }

      console.log(`[v0] [Reddit] Progressive search completed with ${allCompanies.length} total companies`)
    } catch (error: any) {
      console.error("[v0] [Reddit] Error:", error.message)
      throw error
    }
  }

  async search(queries: string[], icp: ICP, desiredCount = 10): Promise<SearchWorkerResult> {
    const startTime = Date.now()
    console.log(`[v0] [Reddit] Starting search for ${desiredCount} companies`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const query = queries[0] || "companies"

      const allCompanies: CompanyResult[] = []
      const companiesPerCall = 20
      const maxCalls = Math.ceil(desiredCount / companiesPerCall)

      console.log(`[v0] [Reddit] Will make ${maxCalls} API calls to get ${desiredCount} companies`)

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        const remainingCount = desiredCount - allCompanies.length
        const countForThisCall = Math.min(companiesPerCall, remainingCount)

        if (countForThisCall <= 0) break

        console.log(`[v0] [Reddit] API call ${callIndex + 1}/${maxCalls}, requesting ${countForThisCall} companies`)

        const systemPrompt = `You are a Reddit community expert. Your task is to find companies that are frequently discussed, recommended, or mentioned on Reddit communities.

Focus ONLY on Reddit as your source. Think about what companies would be mentioned in subreddits like r/startups, r/entrepreneur, r/technology, or industry-specific subreddits.

Return companies that have active Reddit presence or are frequently recommended by Reddit users.

IMPORTANT: Return DIFFERENT companies each time. Avoid duplicates from previous searches.`

        const userPrompt = `Find ${countForThisCall} companies frequently mentioned on Reddit that match: "${query}"

Based on the ICP:
- Industries: ${icp.industries.join(", ")}
- Locations: ${icp.locations.join(", ")}

${allCompanies.length > 0 ? `AVOID these companies already found: ${allCompanies.map((c) => c.name).join(", ")}` : ""}

Return a JSON array with this structure:
[
  {
    "name": "Company Name",
    "website": "https://example.com",
    "location": "City, Country",
    "category": "Industry/Category",
    "description": "Brief description and why Reddit users recommend them"
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
          console.error(`[v0] [Reddit] API error on call ${callIndex + 1}: ${response.statusText}`)
          break
        }

        const data = await response.json()

        const usage = data.usage
        if (usage) {
          console.log(`[v0] [Reddit] Token usage - Input: ${usage.prompt_tokens}, Output: ${usage.completion_tokens}`)
        }

        const answer = data.choices[0].message.content

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [Reddit] Call ${callIndex + 1} returned ${companies.length} companies`)

        // Verify domains before adding to allCompanies
        if (companies.length > 0) {
          const { verified, rejected } = await filterCompaniesByDomain(companies)
          console.log(`[v0] [Reddit] Verified ${verified.length}/${companies.length} companies`)

          allCompanies.push(...verified)
        }

        if (allCompanies.length >= desiredCount) {
          break
        }
      }

      const duration = Date.now() - startTime
      console.log(`[v0] [Reddit] Found ${allCompanies.length} total companies in ${duration} ms`)

      return {
        companies: allCompanies.slice(0, desiredCount),
        source: this.name,
        duration_ms: duration,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error("[v0] [Reddit] Error:", error.message)

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
          source: this.name,
          confidence_score: 0.7,
        }))
      }

      return []
    } catch (error) {
      console.error("[v0] [Reddit] Parse error:", error)
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
