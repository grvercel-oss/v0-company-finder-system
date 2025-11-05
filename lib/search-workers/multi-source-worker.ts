// Multi-source worker that can search across all platforms

import type { CompanyResult } from "./types"
import { filterCompaniesByDomain } from "@/lib/domain-verifier"
import { calculateGPT41MiniCost } from "@/lib/cost-calculator"

export class MultiSourceWorker {
  name: string
  queryVariant: string
  focus: string
  suggestedSources: string[]
  timeout = 150000

  constructor(queryVariant: string, focus: string, suggestedSources: string[], index: number) {
    this.name = `Worker-${index + 1}`
    this.queryVariant = queryVariant
    this.focus = focus
    this.suggestedSources = suggestedSources
  }

  async *searchProgressive(desiredCount = 10): AsyncGenerator<CompanyResult[], void, unknown> {
    console.log(`[v0] [${this.name}] Starting search with variant: "${this.queryVariant}" (focus: ${this.focus})`)
    console.log(`[v0] [${this.name}] Suggested sources: ${this.suggestedSources.join(", ")}`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const allCompanies: CompanyResult[] = []
      const companiesPerCall = 20
      const maxCalls = Math.ceil(desiredCount / companiesPerCall) * 2

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        const remainingCount = desiredCount - allCompanies.length
        if (remainingCount <= 0) break

        const countForThisCall = Math.min(companiesPerCall, remainingCount * 2)

        console.log(
          `[v0] [${this.name}] API call ${callIndex + 1}/${maxCalls}, requesting ${countForThisCall} companies`,
        )

        const sourceInstructions = this.buildSourceInstructions()

        const systemPrompt = `You are an expert at finding companies across multiple platforms: LinkedIn, Reddit, Clutch, ProductHunt, and Crunchbase.

Your task is to search these platforms and find REAL, ACTIVE companies that match the search criteria.

${sourceInstructions}

CRITICAL RULES:
1. Only return companies you are CONFIDENT exist and are currently active
2. All websites must be real, working domains (no made-up URLs)
3. Prefer well-known companies in the niche over obscure ones
4. If unsure about a company's existence, DO NOT include it
5. Return DIFFERENT companies each time to avoid duplicates
6. Focus on the suggested sources but can use others if relevant`

        const userPrompt = `Find ${countForThisCall} REAL, ACTIVE companies that match: "${this.queryVariant}"

Search focus: ${this.focus}
Priority sources: ${this.suggestedSources.join(", ")}

${allCompanies.length > 0 ? `AVOID these companies already found: ${allCompanies.map((c) => c.name).join(", ")}` : ""}

For each company, include:
- Which source you found it on (LinkedIn/Reddit/Clutch/ProductHunt/Crunchbase)
- Confidence score (0.0-1.0) indicating certainty about existence and accuracy

Return a JSON array:
[
  {
    "name": "Company Name",
    "website": "https://example.com",
    "location": "City, Country",
    "category": "Industry/Category",
    "employee_count": "10-50",
    "description": "Brief description",
    "source": "LinkedIn",
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
            model: "gpt-4.1-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[v0] [${this.name}] API error on call ${callIndex + 1}:`, response.status, errorText)
          break
        }

        const data = await response.json()
        const answer = data.choices[0].message.content

        const tokenUsage = data.usage
        const costBreakdown = calculateGPT41MiniCost({
          input_tokens: tokenUsage.prompt_tokens,
          output_tokens: tokenUsage.completion_tokens,
        })

        console.log(
          `[v0] [${this.name}] API call cost: $${costBreakdown.total_cost.toFixed(4)} (${tokenUsage.prompt_tokens} in, ${tokenUsage.completion_tokens} out)`,
        )

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [${this.name}] Call ${callIndex + 1} returned ${companies.length} companies`)

        if (companies.length > 0) {
          const { verified, rejected } = await filterCompaniesByDomain(companies)
          console.log(
            `[v0] [${this.name}] Domain verification: ${verified.length} verified, ${rejected.length} rejected`,
          )

          if (verified.length > 0) {
            const costPerCompany = costBreakdown.total_cost / verified.length
            const companiesWithCost = verified.map((company) => ({
              ...company,
              tokenUsage: {
                prompt_tokens: Math.floor(tokenUsage.prompt_tokens / verified.length),
                completion_tokens: Math.floor(tokenUsage.completion_tokens / verified.length),
                cost: costPerCompany,
              },
            }))

            allCompanies.push(...companiesWithCost)
            yield companiesWithCost
          }
        }

        if (allCompanies.length >= desiredCount) {
          break
        }
      }

      console.log(`[v0] [${this.name}] Search completed with ${allCompanies.length} total companies`)
    } catch (error: any) {
      console.error(`[v0] [${this.name}] Error:`, error.message)
      throw error
    }
  }

  private buildSourceInstructions(): string {
    const instructions: Record<string, string> = {
      LinkedIn:
        "LinkedIn: Professional company profiles, employee counts, locations, industries. Best for established companies.",
      Reddit:
        "Reddit: Community discussions, recommendations, user experiences. Best for finding trending tools and startups.",
      Clutch: "Clutch: B2B service providers with reviews and ratings. Best for agencies and service companies.",
      ProductHunt:
        "ProductHunt: New product launches and startups. Best for innovative tools and early-stage companies.",
      Crunchbase:
        "Crunchbase: Funding data, startup information, company financials. Best for funded startups and growth companies.",
    }

    return this.suggestedSources.map((source) => instructions[source] || "").join("\n")
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
          source: c.source || this.name,
          confidence_score: c.confidence || 0.75,
        }))
      }

      return []
    } catch (error) {
      console.error(`[v0] [${this.name}] Parse error:`, error)
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
