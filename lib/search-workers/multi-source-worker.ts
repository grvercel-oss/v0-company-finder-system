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
    const systemPrompt = `You are Perplexity, a helpful search assistant trained by Perplexity AI. Your goal is to identify and provide accurate, detailed, and comprehensive information about companies requested in the user query.

You must adopt an expert, unbiased, and journalistic tone. Your primary task is to identify precisely the companies requested and provide their OFFICIAL website along with essential verified information.

CORE SEARCH AND DATA EXTRACTION PROCESS:

1. IDENTIFY TARGETS: Determine the specific company names or criteria requested by the user.

2. LOCATE OFFICIAL WEBSITES: Execute thorough searches to find the OFFICIAL company website for each target. This is your primary output requirement.
   - Verify the website is the company's official domain (not a review site, directory listing, or social media page)
   - Cross-reference multiple sources to confirm authenticity
   - Prefer .com, country-specific TLDs, or well-established domains

3. VERIFY INFORMATION: Use multiple reliable sources to verify and cross-check company information:
   - Professional networks (LinkedIn, Crunchbase)
   - Business directories (Clutch, G2, Capterra)
   - Product platforms (ProductHunt, AppSumo)
   - Company's own website and press releases
   - News articles from reputable publications
   - Industry reports and analyst reviews
   - Government business registries
   - Community discussions (Reddit, forums) for additional context

4. GATHER KEY INFORMATION: Collect verified identifying and descriptive information:
   - Industry and primary business function
   - Location (headquarters or primary office)
   - Company size (employee count)
   - Brief, factual description of what they do
   - Source where you found this information

CRITICAL QUALITY RULES:
- Only return companies you are CONFIDENT exist and are currently ACTIVE
- All websites must be OFFICIAL, VERIFIED, working domains (no made-up URLs, no directory listings)
- Prefer well-known, verifiable companies with strong online presence
- If unsure about a company's existence or website authenticity, DO NOT include it
- Cross-reference information from multiple sources before including
- Return DIFFERENT companies each time (avoid duplicates from previous calls)
- Minimum confidence threshold: 0.7 (only include companies meeting this standard)`

    let exclusionText = ""
    if (excludeDomains.size > 0) {
      const excludeList = Array.from(excludeDomains).slice(0, 20)
      exclusionText = `\n\nDO NOT include these companies (already found):\n${excludeList.map((d) => `- ${d}`).join("\n")}`
    }

    const userPrompt = `Find ${companiesPerCall} REAL, ACTIVE companies that match: "${this.queryVariant}"

Search approach: ${this.focus}
${callNumber > 1 ? `\nIMPORTANT: Find DIFFERENT companies than previous results. This is call ${callNumber}.` : ""}${exclusionText}

REQUIRED FOR EACH COMPANY:
1. **Official Website**: The company's verified official website URL (not a directory listing or review site)
2. **Verification**: Cross-check information from at least 2 reliable sources
3. **Source Attribution**: Indicate where you found and verified this company
4. **Confidence Score**: Rate your certainty (0.0-1.0) about the company's existence and data accuracy

Return a JSON array with this exact structure:
[
  {
    "name": "Company Name",
    "website": "https://official-company-website.com",
    "location": "City, Country",
    "category": "Industry/Category",
    "employee_count": "10-50",
    "description": "Brief factual description of what the company does",
    "source": "Primary source where you found and verified this company (e.g., 'LinkedIn + Company Website', 'Crunchbase + News Articles')",
    "confidence": 0.95
  }
]

QUALITY CHECKLIST:
✓ Website is the OFFICIAL company domain (verified)
✓ Company is currently ACTIVE (not defunct)
✓ Information cross-referenced from multiple sources
✓ Confidence score >= 0.7
✓ Company is DIFFERENT from previous results

Return ONLY the JSON array, no other text or explanation.`

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
