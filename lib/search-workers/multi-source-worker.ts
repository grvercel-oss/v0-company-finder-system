// Multi-source worker that searches the open internet

import type { CompanyResult } from "./types"
import { calculateGPT41MiniCost } from "@/lib/cost-calculator"

export class MultiSourceWorker {
  name: string
  queryVariant: string
  focus: string
  timeout = 150000

  constructor(queryVariant: string, focus: string, index: number) {
    this.name = `Worker-${index + 1}`
    this.queryVariant = queryVariant
    this.focus = focus
  }

  async *searchProgressive(desiredCount = 10): AsyncGenerator<CompanyResult[], void, unknown> {
    console.log(`[v0] [${this.name}] Starting search: "${this.queryVariant}" (focus: ${this.focus})`)

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured")
      }

      const companiesPerCall = 5
      const maxCalls = Math.ceil(desiredCount / companiesPerCall)
      let totalCompaniesFound = 0

      console.log(`[v0] [${this.name}] Will make up to ${maxCalls} calls, ${companiesPerCall} companies each`)

      for (let callIndex = 0; callIndex < maxCalls; callIndex++) {
        if (totalCompaniesFound >= desiredCount) {
          console.log(`[v0] [${this.name}] Reached desired count (${desiredCount}), stopping`)
          break
        }

        console.log(
          `[v0] [${this.name}] API call ${callIndex + 1}/${maxCalls}: Requesting ${companiesPerCall} companies`,
        )

        const systemPrompt = `You are an expert at finding companies from across the entire internet using your knowledge base.

Your task is to find REAL, ACTIVE companies that match the search criteria. You can use information from:
- Professional networks (LinkedIn, etc.)
- Business directories (Clutch, Crunchbase, etc.)
- Product platforms (ProductHunt, etc.)
- Community discussions (Reddit, forums, etc.)
- Company websites and databases
- News articles and press releases
- Industry reports and listings
- ANY other reliable source you know about

CRITICAL RULES:
1. Only return companies you are CONFIDENT exist and are currently active
2. All websites must be real, working domains (no made-up URLs)
3. Prefer well-known, verifiable companies
4. If unsure about a company's existence, DO NOT include it
5. Return DIFFERENT companies each time (avoid duplicates from previous calls)
6. Search ANYWHERE on the internet - you are not limited to specific platforms`

        const userPrompt = `Find ${companiesPerCall} REAL, ACTIVE companies that match: "${this.queryVariant}"

Search approach: ${this.focus}
${callIndex > 0 ? `\nIMPORTANT: Find DIFFERENT companies than previous results. This is call ${callIndex + 1}.` : ""}

For each company, include:
- Where you found information about it (any source)
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
    "source": "where you found this company",
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
          console.error(`[v0] [${this.name}] API error:`, response.status, errorText)
          continue // Try next call
        }

        const data = await response.json()
        const answer = data.choices[0].message.content

        const tokenUsage = data.usage
        const costBreakdown = calculateGPT41MiniCost({
          input_tokens: tokenUsage.prompt_tokens,
          output_tokens: tokenUsage.completion_tokens,
        })

        console.log(
          `[v0] [${this.name}] Call ${callIndex + 1} cost: $${costBreakdown.total_cost.toFixed(4)} (${tokenUsage.prompt_tokens} in, ${tokenUsage.completion_tokens} out)`,
        )

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [${this.name}] Call ${callIndex + 1} found ${companies.length} companies`)

        if (companies.length > 0) {
          const costPerCompany = costBreakdown.total_cost / companies.length
          totalCompaniesFound += companies.length

          for (const company of companies) {
            const companyWithCost = {
              ...company,
              tokenUsage: {
                prompt_tokens: Math.floor(tokenUsage.prompt_tokens / companies.length),
                completion_tokens: Math.floor(tokenUsage.completion_tokens / companies.length),
                cost: costPerCompany,
              },
            }

            yield [companyWithCost]
          }
        }
      }

      console.log(`[v0] [${this.name}] Search completed, total companies: ${totalCompaniesFound}`)
    } catch (error: any) {
      console.error(`[v0] [${this.name}] Error:`, error.message)
      throw error
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
