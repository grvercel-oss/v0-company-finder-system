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
      const allFoundDomains = new Set<string>(excludeDomains)

      console.log(
        `[v0] [${this.name}] Will make ${parallelCalls} parallel API calls per batch, ${companiesPerCall} companies each`,
      )

      while (!signal?.aborted) {
        batchIndex++

        console.log(`[v0] [${this.name}] Batch ${batchIndex}: Starting ${parallelCalls} parallel API calls`)
        if (allFoundDomains.size > 0) {
          console.log(`[v0] [${this.name}] Excluding ${allFoundDomains.size} already-found companies`)
        }

        const apiCallPromises = Array.from({ length: parallelCalls }, (_, i) =>
          this.makeApiCall(apiKey, companiesPerCall, batchIndex * parallelCalls + i + 1, allFoundDomains, signal),
        )

        const results = await Promise.allSettled(apiCallPromises)

        const batchCompanies: Array<{ company: CompanyResult; callNumber: number; cost: number; tokenUsage: any }> = []

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
              batchCompanies.push({
                company,
                callNumber,
                cost: costPerCompany,
                tokenUsage: {
                  prompt_tokens: Math.floor(tokenUsage.prompt_tokens / companies.length),
                  completion_tokens: Math.floor(tokenUsage.completion_tokens / companies.length),
                },
              })
            }
          } else if (result.status === "rejected") {
            console.error(`[v0] [${this.name}] API call failed:`, result.reason)
          }
        }

        const uniqueCompanies: typeof batchCompanies = []
        const batchDomains = new Set<string>()

        for (const item of batchCompanies) {
          const domain = item.company.domain

          // Skip if we've already found this domain in any previous batch or in this batch
          if (allFoundDomains.has(domain) || batchDomains.has(domain)) {
            console.log(`[v0] [${this.name}] Skipping duplicate: ${domain}`)
            continue
          }

          batchDomains.add(domain)
          allFoundDomains.add(domain)
          uniqueCompanies.push(item)
        }

        console.log(
          `[v0] [${this.name}] Batch ${batchIndex}: Found ${batchCompanies.length} companies, ${uniqueCompanies.length} unique after deduplication`,
        )

        for (const item of uniqueCompanies) {
          if (signal?.aborted) break

          const companyWithCost = {
            ...item.company,
            tokenUsage: {
              prompt_tokens: item.tokenUsage.prompt_tokens,
              completion_tokens: item.tokenUsage.completion_tokens,
              cost: item.cost,
            },
          }

          yield [companyWithCost]
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

You must adopt an expert, unbiased, and journalistic tone. Your primary task is to identify precisely the companies requested and provide their OFFICIAL PRIMARY website along with essential verified information.

CORE SEARCH AND DATA EXTRACTION PROCESS:

1. IDENTIFY TARGETS: Determine the specific company names or criteria requested by the user.

2. LOCATE OFFICIAL PRIMARY WEBSITES: Execute thorough searches to find the OFFICIAL PRIMARY company website for each target. This is your most critical output requirement.
   
   DOMAIN VERIFICATION REQUIREMENTS:
   - The website MUST be the company's PRIMARY official domain (not a subsidiary, regional variant, or alternative domain)
   - Cross-reference the domain across AT LEAST 3 different reliable sources to confirm authenticity
   - Verify the domain is currently active and accessible
   - Prefer the simplest, most direct domain (e.g., "company.com" over "company-global.com" or "company-usa.com")
   - DO NOT include:
     * Review sites (g2.com, trustpilot.com, etc.)
     * Directory listings (yelp.com, yellowpages.com, etc.)
     * Social media pages (linkedin.com, facebook.com, etc.)
     * Subsidiary or regional domains unless that's the only official domain
     * Alternative domains when a primary domain exists
   
   CONFIDENCE SCORING FOR DOMAINS:
   - If you find the domain on 3+ reliable sources with consistent information: confidence >= 0.85
   - If you find the domain on 2 reliable sources: confidence = 0.75-0.84
   - If you find the domain on only 1 source or sources conflict: confidence < 0.7 (DO NOT INCLUDE)
   - If you're uncertain whether it's the PRIMARY domain vs a subsidiary: confidence < 0.7 (DO NOT INCLUDE)

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

5. FIND KEY PERSONNEL CONTACTS: Search for decision-makers and key personnel at the company:
   - Focus on: Directors, C-level executives, Sales Managers, Business Development, Marketing Heads, Department Heads
   - DO NOT include: Generic support emails (support@, info@, hello@, contact@)
   - DO NOT include: Personal assistants or administrative staff unless they're decision-makers
   - For each contact, find:
     * Full name
     * Job title/role
     * Professional email (preferably company email, not personal)
     * LinkedIn profile URL (if available)
   - Verify contacts from:
     * LinkedIn profiles
     * Company "About Us" or "Team" pages
     * Professional directories
     * News articles and press releases
     * Conference speaker lists
   - Only include contacts you can verify from at least 2 sources
   - Confidence scoring for contacts:
     * 0.9+: Found on company website + LinkedIn with matching details
     * 0.8-0.89: Found on LinkedIn + one other professional source
     * 0.7-0.79: Found on one reliable source with complete information
     * < 0.7: DO NOT INCLUDE

CRITICAL QUALITY RULES:
- Only return companies you are CONFIDENT exist and are currently ACTIVE
- All websites must be OFFICIAL, PRIMARY, VERIFIED, working domains (no made-up URLs, no directory listings, no subsidiary domains)
- Each domain must be cross-referenced across at least 3 sources before inclusion
- Prefer well-known, verifiable companies with strong online presence
- If unsure about a company's existence, website authenticity, or whether it's the PRIMARY domain, DO NOT include it
- If you find conflicting domains for the same company, DO NOT include it (set confidence < 0.7)
- Return DIFFERENT companies each time (avoid duplicates from previous calls)
- Minimum confidence threshold: 0.7 (only include companies meeting this standard)
- When in doubt about domain accuracy, EXCLUDE the company rather than risk including wrong information
- For contacts: Only include verified decision-makers, not generic support emails`

    let exclusionText = ""
    if (excludeDomains.size > 0) {
      const excludeList = Array.from(excludeDomains).slice(0, 20)
      exclusionText = `\n\nDO NOT include these companies (already found):\n${excludeList.map((d) => `- ${d}`).join("\n")}`
    }

    const userPrompt = `Find ${companiesPerCall} REAL, ACTIVE companies that match: "${this.queryVariant}"

Search approach: ${this.focus}
${callNumber > 1 ? `\nIMPORTANT: Find DIFFERENT companies than previous results. This is call ${callNumber}.` : ""}${exclusionText}

REQUIRED FOR EACH COMPANY:
1. **Official Website**: The company's verified official PRIMARY website URL (not a directory listing, review site, or subsidiary domain)
2. **Verification**: Cross-check information from at least 2 reliable sources
3. **Source Attribution**: Indicate where you found and verified this company
4. **Confidence Score**: Rate your certainty (0.0-1.0) about the company's existence and data accuracy
5. **Key Personnel Contacts**: Find 1-3 decision-makers with their professional emails (NOT generic support emails)

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
    "confidence": 0.95,
    "contacts": [
      {
        "name": "John Smith",
        "role": "CEO & Founder",
        "email": "john.smith@company.com",
        "linkedin_url": "https://linkedin.com/in/johnsmith",
        "source": "Company website + LinkedIn",
        "confidence": 0.95
      },
      {
        "name": "Jane Doe",
        "role": "Head of Sales",
        "email": "jane.doe@company.com",
        "linkedin_url": "https://linkedin.com/in/janedoe",
        "source": "LinkedIn + Company team page",
        "confidence": 0.90
      }
    ]
  }
]

QUALITY CHECKLIST:
✓ Website is the OFFICIAL PRIMARY company domain (verified)
✓ Company is currently ACTIVE (not defunct)
✓ Information cross-referenced from multiple sources
✓ Confidence score >= 0.7
✓ Company is DIFFERENT from previous results
✓ Contacts are decision-makers with professional emails (NOT support@, info@, etc.)
✓ Each contact verified from at least 2 sources

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
          contacts: Array.isArray(c.contacts)
            ? c.contacts.map((contact: any) => ({
                name: contact.name || "",
                role: contact.role || "",
                email: contact.email || "",
                phone: contact.phone,
                linkedin_url: contact.linkedin_url,
                source: contact.source,
                confidence_score: contact.confidence || 0.75,
              }))
            : [],
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
