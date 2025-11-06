// Multi-source worker that searches the open internet using Perplexity

import type { CompanyResult } from "./types"
import { calculatePerplexitySonarProCost } from "@/lib/cost-calculator"

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

  async *searchProgressive(signal?: AbortSignal): AsyncGenerator<CompanyResult[], void, unknown> {
    console.log(`[v0] [${this.name}] Starting search: "${this.queryVariant}" (focus: ${this.focus})`)

    try {
      const apiKey = process.env.PERPLEXITY_API_KEY
      if (!apiKey) {
        throw new Error("PERPLEXITY_API_KEY not configured")
      }

      const companiesPerCall = 5
      let callIndex = 0

      console.log(`[v0] [${this.name}] Will search in batches of ${companiesPerCall} companies until stopped`)

      while (!signal?.aborted) {
        callIndex++

        console.log(`[v0] [${this.name}] API call ${callIndex}: Requesting ${companiesPerCall} companies`)

        const systemPrompt = `You are an expert at finding companies from across the entire internet using your knowledge base and web search.

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
${callIndex > 1 ? `\nIMPORTANT: Find DIFFERENT companies than previous results. This is call ${callIndex}.` : ""}

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

        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            return_citations: true,
          }),
          signal, // Pass abort signal to fetch
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[v0] [${this.name}] API error:`, response.status, errorText)
          continue // Try next call
        }

        const data = await response.json()
        const answer = data.choices[0].message.content

        const tokenUsage = data.usage || {}
        const costBreakdown = calculatePerplexitySonarProCost({
          input_tokens: tokenUsage.prompt_tokens || 0,
          output_tokens: tokenUsage.completion_tokens || 0,
        })

        console.log(
          `[v0] [${this.name}] Call ${callIndex} cost: $${costBreakdown.total_cost.toFixed(4)} (${tokenUsage.prompt_tokens || 0} in, ${tokenUsage.completion_tokens || 0} out)`,
        )

        const companies = this.parseCompanies(answer)
        console.log(`[v0] [${this.name}] Call ${callIndex} found ${companies.length} companies`)

        if (companies.length > 0) {
          const costPerCompany = costBreakdown.total_cost / companies.length

          for (const company of companies) {
            if (signal?.aborted) break

            const companyWithCost = {
              ...company,
              tokenUsage: {
                prompt_tokens: Math.floor((tokenUsage.prompt_tokens || 0) / companies.length),
                completion_tokens: Math.floor((tokenUsage.completion_tokens || 0) / companies.length),
                cost: costPerCompany,
              },
            }

            yield [companyWithCost]
          }
        }

        if (signal?.aborted) {
          console.log(`[v0] [${this.name}] Search aborted by stream route`)
          break
        }
      }

      console.log(`[v0] [${this.name}] Search completed after ${callIndex} calls`)
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log(`[v0] [${this.name}] Search aborted`)
      } else {
        console.error(`[v0] [${this.name}] Error:`, error.message)
        throw error
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
