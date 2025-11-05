import type { SearchWorkerResult, ICP, CompanyResult, ProgressiveSearchWorker } from "../types"
import { filterCompaniesByDomain } from "@/lib/domain-verifier"

export class LinkedInSearchWorker implements ProgressiveSearchWorker {
  name = "LinkedIn"
  timeout = 150000

  async *searchProgressive(
    queries: string[],
    icp: ICP,
    desiredCount = 10,
  ): AsyncGenerator<CompanyResult[], void, unknown> {
    console.log(`[v0] [LinkedIn] Starting progressive search for ${desiredCount} companies`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const query = queries[0] || "companies"
      const allCompanies: CompanyResult[] = []
      const companiesPerCall = 20
      const maxCalls = Math.ceil(desiredCount / companiesPerCall) * 2

      console.log(`[v0] [LinkedIn] Will make up to ${maxCalls} API calls`)

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        const remainingCount = desiredCount - allCompanies.length
        if (remainingCount <= 0) break

        const countForThisCall = Math.min(companiesPerCall, remainingCount * 2)

        console.log(`[v0] [LinkedIn] API call ${callIndex + 1}/${maxCalls}, requesting ${countForThisCall} companies`)

        const systemPrompt = `You are a LinkedIn company search expert with access to real, current company data.

CRITICAL RULES:
1. Only return companies you are CONFIDENT exist and are currently active
2. All websites must be real, working domains (no made-up URLs)
3. Prefer well-known companies in the niche over obscure ones
4. If unsure about a company's existence, DO NOT include it
5. Return DIFFERENT companies each time to avoid duplicates

Focus on LinkedIn as your primary source. Return specialized companies, startups, and focused providers.`

        const userPrompt = `Find ${countForThisCall} REAL, ACTIVE companies on LinkedIn that match: "${query}"

Based on the ICP:
- Industries: ${icp.industries.join(", ")}
- Locations: ${icp.locations.join(", ")}
- Company sizes: ${icp.company_sizes.join(", ")}

${allCompanies.length > 0 ? `AVOID these companies already found: ${allCompanies.map((c) => c.name).join(", ")}` : ""}

For each company, include a confidence score (0.0-1.0) indicating how certain you are that:
- The company exists and is active
- The website is correct and working
- The information is current

Return a JSON array with this structure:
[
  {
    "name": "Company Name",
    "website": "https://example.com",
    "location": "City, Country",
    "category": "Industry/Category",
    "employee_count": "10-50",
    "description": "Brief description",
    "confidence": 0.95
  }
]

Only include companies with confidence >= 0.7. Return ONLY the JSON array, no other text.`

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5-nano",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`[v0] [LinkedIn] API error on call ${callIndex + 1}: ${response.status} ${response.statusText}`)
          console.error(`[v0] [LinkedIn] Error details:`, errorBody)
          console.error(`[v0] [LinkedIn] Request model:`, "gpt-5-nano")
          console.error(
            `[v0] [LinkedIn] Request messages:`,
            JSON.stringify([
              { role: "system", content: systemPrompt.substring(0, 100) + "..." },
              { role: "user", content: userPrompt.substring(0, 100) + "..." },
            ]),
          )
          break
        }

        const data = await response.json()
        const answer = data.choices[0].message.content

        const tokenUsage = data.usage
          ? {
              prompt_tokens: data.usage.prompt_tokens || 0,
              completion_tokens: data.usage.completion_tokens || 0,
              cost:
                ((data.usage.prompt_tokens || 0) / 1_000_000) * 0.05 +
                ((data.usage.completion_tokens || 0) / 1_000_000) * 0.4,
            }
          : undefined

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [LinkedIn] Call ${callIndex + 1} returned ${companies.length} companies`)

        if (tokenUsage) {
          console.log(
            `[v0] [LinkedIn] Token usage: ${tokenUsage.prompt_tokens} input, ${tokenUsage.completion_tokens} output, cost: $${tokenUsage.cost.toFixed(4)}`,
          )
        }

        if (companies.length > 0) {
          const { verified, rejected } = await filterCompaniesByDomain(companies)
          console.log(`[v0] [LinkedIn] Domain verification: ${verified.length} verified, ${rejected.length} rejected`)

          if (verified.length > 0) {
            const companiesWithCost = verified.map((company) => ({
              ...company,
              tokenUsage: tokenUsage
                ? {
                    prompt_tokens: Math.floor(tokenUsage.prompt_tokens / verified.length),
                    completion_tokens: Math.floor(tokenUsage.completion_tokens / verified.length),
                    cost: tokenUsage.cost / verified.length,
                  }
                : undefined,
            }))
            allCompanies.push(...companiesWithCost)
            yield companiesWithCost
          }
        }
      }

      console.log(`[v0] [LinkedIn] Progressive search completed with ${allCompanies.length} total companies`)
    } catch (error: any) {
      console.error("[v0] [LinkedIn] Error:", error.message)
      throw error
    }
  }

  async search(queries: string[], icp: ICP, desiredCount = 10): Promise<SearchWorkerResult> {
    const startTime = Date.now()
    console.log(`[v0] [LinkedIn] Starting search for ${desiredCount} companies`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const query = queries[0] || "companies"

      const allCompanies: CompanyResult[] = []
      const companiesPerCall = 20
      const maxCalls = Math.ceil(desiredCount / companiesPerCall)

      console.log(`[v0] [LinkedIn] Will make ${maxCalls} API calls to get ${desiredCount} companies`)

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        const remainingCount = desiredCount - allCompanies.length
        const countForThisCall = Math.min(companiesPerCall, remainingCount)

        if (countForThisCall <= 0) break

        console.log(`[v0] [LinkedIn] API call ${callIndex + 1}/${maxCalls}, requesting ${countForThisCall} companies`)

        const systemPrompt = `You are a LinkedIn company search expert. Your task is to find real companies that would appear on LinkedIn based on the search query.

Focus ONLY on LinkedIn as your source. Simulate what you would find by searching LinkedIn's company directory.

Return specialized companies, startups, and focused providers - NOT large generic corporations unless they're the primary players in this specific niche.

IMPORTANT: Return DIFFERENT companies each time. Avoid duplicates from previous searches.`

        const userPrompt = `Find ${countForThisCall} companies on LinkedIn that match: "${query}"

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
            model: "gpt-5-nano",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`[v0] [LinkedIn] API error on call ${callIndex + 1}: ${response.status} ${response.statusText}`)
          console.error(`[v0] [LinkedIn] Error details:`, errorBody)
          break
        }

        const data = await response.json()
        const answer = data.choices[0].message.content

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [LinkedIn] Call ${callIndex + 1} returned ${companies.length} companies`)

        allCompanies.push(...companies)

        if (allCompanies.length >= desiredCount) {
          break
        }
      }

      const duration = Date.now() - startTime
      console.log(`[v0] [LinkedIn] Found ${allCompanies.length} total companies in ${duration} ms`)

      return {
        companies: allCompanies.slice(0, desiredCount),
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
          confidence_score: c.confidence || 0.75,
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
