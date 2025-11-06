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

  async *searchProgressive(
    signal?: AbortSignal,
    excludeDomains: Set<string> = new Set(),
  ): AsyncGenerator<CompanyResult[], void, unknown> {
    console.log(`[v0] [${this.name}] Starting search: "${this.queryVariant}" (focus: ${this.focus})`)

    try {
      const apiKey = process.env.PERPLEXITY_API_KEY
      if (!apiKey) {
        throw new Error("PERPLEXITY_API_KEY not configured")
      }

      const companiesPerCall = 5
      const parallelCalls = 4
      let batchIndex = 0

      console.log(
        `[v0] [${this.name}] Will make ${parallelCalls} parallel API calls per batch, ${companiesPerCall} companies each`,
      )

      while (!signal?.aborted) {
        batchIndex++

        console.log(`[v0] [${this.name}] Batch ${batchIndex}: Starting ${parallelCalls} parallel API calls`)
        if (excludeDomains.size > 0) {
          console.log(`[v0] [${this.name}] Excluding ${excludeDomains.size} already-found companies`)
        }

        const apiCallPromises = Array.from({ length: parallelCalls }, (_, i) =>
          this.makeApiCall(apiKey, companiesPerCall, batchIndex * parallelCalls + i + 1, excludeDomains, signal),
        )

        const results = await Promise.allSettled(apiCallPromises)

        for (const result of results) {
          if (signal?.aborted) break

          if (result.status === "fulfilled" && result.value.companies.length > 0) {
            const { companies, callNumber, cost, tokenUsage } = result.value

            console.log(
              `[v0] [${this.name}] Call ${callNumber} cost: $${cost.toFixed(4)} (${tokenUsage.prompt_tokens} in, ${tokenUsage.completion_tokens} out)`,
            )
            console.log(`[v0] [${this.name}] Call ${callNumber} found ${companies.length} companies`)

            const costPerCompany = cost / companies.length

            for (const company of companies) {
              if (signal?.aborted) break

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
          } else if (result.status === "rejected") {
            console.error(`[v0] [${this.name}] API call failed:`, result.reason)
          }
        }

        if (signal?.aborted) {
          console.log(`[v0] [${this.name}] Search aborted by stream route`)
          break
        }
      }

      console.log(
        `[v0] [${this.name}] Search completed after ${batchIndex} batches (${batchIndex * parallelCalls} total calls)`,
      )
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log(`[v0] [${this.name}] Search aborted`)
      } else {
        console.error(`[v0] [${this.name}] Error:`, error.message)
        throw error
      }
    }
  }

  private async makeApiCall(
    apiKey: string,
    companiesPerCall: number,
    callNumber: number,
    excludeDomains: Set<string>,
    signal?: AbortSignal,
  ): Promise<{ companies: CompanyResult[]; callNumber: number; cost: number; tokenUsage: any }> {
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

    let exclusionText = ""
    if (excludeDomains.size > 0) {
      const excludeList = Array.from(excludeDomains).slice(0, 20)
      exclusionText = `\n\nDO NOT include these companies (already found):\n${excludeList.map((d) => `- ${d}`).join("\n")}`
    }

    const userPrompt = `Find ${companiesPerCall} REAL, ACTIVE companies that match: "${this.queryVariant}"

Search approach: ${this.focus}
${callNumber > 1 ? `\nIMPORTANT: Find DIFFERENT companies than previous results. This is call ${callNumber}.` : ""}${exclusionText}

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
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const answer = data.choices[0].message.content

    const tokenUsage = data.usage || {}
    const costBreakdown = calculatePerplexitySonarProCost({
      input_tokens: tokenUsage.prompt_tokens || 0,
      output_tokens: tokenUsage.completion_tokens || 0,
    })

    const companies = this.parseCompanies(answer)

    return {
      companies,
      callNumber,
      cost: costBreakdown.total_cost,
      tokenUsage: {
        prompt_tokens: tokenUsage.prompt_tokens || 0,
        completion_tokens: tokenUsage.completion_tokens || 0,
      },
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
