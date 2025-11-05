import type { SearchWorkerResult, ICP, CompanyResult, ProgressiveSearchWorker } from "../types"
import { filterCompaniesByDomain } from "@/lib/domain-verifier"

export class CrunchbaseSearchWorker implements ProgressiveSearchWorker {
  name = "Crunchbase"
  timeout = 150000

  async *searchProgressive(
    queries: string[],
    icp: ICP,
    desiredCount = 10,
  ): AsyncGenerator<CompanyResult[], void, unknown> {
    console.log(`[v0] [Crunchbase] Starting progressive search for ${desiredCount} companies`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const query = queries[0] || "companies"
      const allCompanies: CompanyResult[] = []
      const companiesPerCall = 20
      const maxCalls = Math.ceil(desiredCount / companiesPerCall)

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        const remainingCount = desiredCount - allCompanies.length
        const countForThisCall = Math.min(companiesPerCall, remainingCount)

        if (countForThisCall <= 0) break

        console.log(`[v0] [Crunchbase] API call ${callIndex + 1}/${maxCalls}, requesting ${countForThisCall} companies`)

        const systemPrompt = `You are a Crunchbase expert. Your task is to find funded startups and companies that would have profiles on Crunchbase.

Focus ONLY on Crunchbase as your source. Think about what companies would be listed on Crunchbase with funding information, investor details, and company metrics.

Crunchbase specializes in: funded startups, venture-backed companies, acquisition data, funding rounds, etc.

IMPORTANT: Return DIFFERENT companies each time. Avoid duplicates from previous searches.`

        const userPrompt = `Find ${countForThisCall} funded companies on Crunchbase that match: "${query}"

Based on the ICP:
- Industries: ${icp.industries.join(", ")}
- Locations: ${icp.locations.join(", ")}
- Funding stages: ${icp.funding_stages?.join(", ") || "various"}

${allCompanies.length > 0 ? `AVOID these companies already found: ${allCompanies.map((c) => c.name).join(", ")}` : ""}

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
            model: "gpt-5-nano", // Updated to correct GPT-5 Nano model identifier
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        })

        if (!response.ok) {
          console.error(`[v0] [Crunchbase] API error on call ${callIndex + 1}: ${response.statusText}`)
          break
        }

        const data = await response.json()

        const tokenUsage = data.usage
          ? {
              prompt_tokens: data.usage.prompt_tokens || 0,
              completion_tokens: data.usage.completion_tokens || 0,
              cost:
                ((data.usage.prompt_tokens || 0) / 1_000_000) * 0.05 +
                ((data.usage.completion_tokens || 0) / 1_000_000) * 0.4,
            }
          : undefined

        if (tokenUsage) {
          console.log(
            `[v0] [Crunchbase] Token usage: ${tokenUsage.prompt_tokens} input, ${tokenUsage.completion_tokens} output, cost: $${tokenUsage.cost.toFixed(4)}`,
          )
        }

        const answer = data.choices[0].message.content

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [Crunchbase] Call ${callIndex + 1} returned ${companies.length} companies`)

        if (companies.length > 0) {
          const { verified, rejected } = await filterCompaniesByDomain(companies)
          console.log(`[v0] [Crunchbase] Verified ${verified.length}/${companies.length} companies`)

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

        if (allCompanies.length >= desiredCount) {
          break
        }
      }

      console.log(`[v0] [Crunchbase] Progressive search completed with ${allCompanies.length} total companies`)
    } catch (error: any) {
      console.error("[v0] [Crunchbase] Error:", error.message)
      throw error
    }
  }

  async search(queries: string[], icp: ICP, desiredCount = 10): Promise<SearchWorkerResult> {
    const startTime = Date.now()
    console.log(`[v0] [Crunchbase] Starting search for ${desiredCount} companies`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const query = queries[0] || "companies"

      const allCompanies: CompanyResult[] = []
      const companiesPerCall = 20
      const maxCalls = Math.ceil(desiredCount / companiesPerCall)

      console.log(`[v0] [Crunchbase] Will make ${maxCalls} API calls to get ${desiredCount} companies`)

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        const remainingCount = desiredCount - allCompanies.length
        const countForThisCall = Math.min(companiesPerCall, remainingCount)

        if (countForThisCall <= 0) break

        console.log(`[v0] [Crunchbase] API call ${callIndex + 1}/${maxCalls}, requesting ${countForThisCall} companies`)

        const systemPrompt = `You are a Crunchbase expert. Your task is to find funded startups and companies that would have profiles on Crunchbase.

Focus ONLY on Crunchbase as your source. Think about what companies would be listed on Crunchbase with funding information, investor details, and company metrics.

Crunchbase specializes in: funded startups, venture-backed companies, acquisition data, funding rounds, etc.

IMPORTANT: Return DIFFERENT companies each time. Avoid duplicates from previous searches.`

        const userPrompt = `Find ${countForThisCall} funded companies on Crunchbase that match: "${query}"

Based on the ICP:
- Industries: ${icp.industries.join(", ")}
- Locations: ${icp.locations.join(", ")}
- Funding stages: ${icp.funding_stages?.join(", ") || "various"}

${allCompanies.length > 0 ? `AVOID these companies already found: ${allCompanies.map((c) => c.name).join(", ")}` : ""}

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
            model: "gpt-5-nano", // Updated to correct GPT-5 Nano model identifier
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        })

        if (!response.ok) {
          console.error(`[v0] [Crunchbase] API error on call ${callIndex + 1}: ${response.statusText}`)
          break
        }

        const data = await response.json()
        const answer = data.choices[0].message.content

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [Crunchbase] Call ${callIndex + 1} returned ${companies.length} companies`)

        allCompanies.push(...companies)

        if (allCompanies.length >= desiredCount) {
          break
        }
      }

      const duration = Date.now() - startTime
      console.log(`[v0] [Crunchbase] Found ${allCompanies.length} total companies in ${duration} ms`)

      return {
        companies: allCompanies.slice(0, desiredCount),
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
