// ICP Extractor - converts raw query to structured ICP using OpenAI

import type { ICP } from "./types"

export async function extractICP(rawQuery: string): Promise<ICP> {
  console.log("[v0] Extracting ICP from query:", rawQuery)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const prompt = `You are an expert at understanding business search queries and extracting Ideal Customer Profile (ICP) criteria.

User Query: "${rawQuery}"

Extract the following ICP criteria from this query:
1. **Industries**: What industries/sectors are mentioned or implied? (e.g., "SaaS", "E-commerce", "Healthcare")
2. **Locations**: What geographic locations are mentioned? (e.g., "San Francisco", "United States", "Europe")
3. **Company Sizes**: What company sizes are implied? (e.g., "startup", "50-100 employees", "enterprise")
4. **Technologies**: What technologies or tech stacks are mentioned? (e.g., "React", "AWS", "AI/ML")
5. **Keywords**: Important keywords that describe the target companies
6. **Funding Stages**: Any funding stage mentioned? (e.g., "Series A", "Seed", "Bootstrapped")
7. **Revenue Ranges**: Any revenue information? (e.g., "$1M-$10M", "high-growth")
8. **Description**: A clear 1-2 sentence description of the ideal company profile

Also generate 6-12 diverse search queries that would help find these companies across different sources (Google, Clutch, LinkedIn, etc.).

Return JSON with this structure:
{
  "icp": {
    "industries": [...],
    "locations": [...],
    "company_sizes": [...],
    "technologies": [...],
    "keywords": [...],
    "funding_stages": [...],
    "revenue_ranges": [...],
    "description": "..."
  },
  "search_queries": [
    "query 1 for Google",
    "query 2 for Clutch",
    ...
  ]
}`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-nano", // Updated model
        messages: [
          {
            role: "system",
            content:
              "You are an expert at analyzing business search queries and extracting structured ICP criteria. Be specific and actionable.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[v0] ICP extraction API error: ${response.status} ${response.statusText}`)
      console.error(`[v0] ICP extraction error details:`, errorBody)
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    console.log("[v0] ICP extracted:", result.icp)
    console.log("[v0] Generated", result.search_queries.length, "search queries")

    return {
      industries: result.icp.industries || [],
      locations: result.icp.locations || [],
      company_sizes: result.icp.company_sizes || [],
      technologies: result.icp.technologies || [],
      keywords: result.icp.keywords || [],
      funding_stages: result.icp.funding_stages || [],
      revenue_ranges: result.icp.revenue_ranges || [],
      description: result.icp.description || rawQuery,
    }
  } catch (error: any) {
    console.error("[v0] ICP extraction error:", error.message)
    // Fallback to basic ICP
    return {
      industries: [],
      locations: [],
      company_sizes: [],
      description: rawQuery,
    }
  }
}

export async function generateSearchQueries(rawQuery: string, icp: ICP): Promise<string[]> {
  console.log("[v0] Generating search queries for ICP")

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // Fallback to basic queries
    return [rawQuery]
  }

  const prompt = `Generate 8-12 highly specific search queries to find companies that SPECIALIZE in this area (not large corporations that just offer it as one service):

Raw Query: "${rawQuery}"

ICP:
${JSON.stringify(icp, null, 2)}

IMPORTANT RULES:
1. Focus on finding SPECIALIZED companies, startups, and focused providers
2. AVOID queries that would return large generic corporations (e.g., don't use "site:telecom.com" for eSIM searches)
3. Use specific product/service names, not broad industry terms
4. Include terms like "startup", "provider", "platform", "solution", "specialized"
5. For technology searches, focus on companies that BUILD or SPECIALIZE in that tech, not just use it

Generate queries optimized for different sources:
- 3-4 queries for finding specialized providers and startups
- 2-3 queries for finding companies on product directories (ProductHunt, G2, Capterra)
- 2-3 queries for finding companies on tech platforms (GitHub, Stack Overflow, dev communities)
- 2-3 queries for finding companies in industry-specific publications

Examples of GOOD vs BAD queries:
- BAD: "site:telecom operators eSIM technology" (finds big telecoms)
- GOOD: "eSIM platform provider startup" (finds specialized companies)
- BAD: "AI companies" (too broad)
- GOOD: "AI-powered customer support platform startup" (specific)

Return JSON with this exact structure:
{
  "queries": ["query 1", "query 2", ...]
}`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-nano", // Updated model
        messages: [
          {
            role: "system",
            content:
              "You are an expert at generating precise search queries that find specialized companies and startups, not generic large corporations. Focus on specificity and relevance.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[v0] Query generation API error: ${response.status} ${response.statusText}`)
      console.error(`[v0] Query generation error details:`, errorBody)
      return [rawQuery]
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    console.log("[v0] Generated", result.queries?.length || 0, "search queries")

    return result.queries || [rawQuery]
  } catch (error: any) {
    console.error("[v0] Query generation error:", error.message)
    return [rawQuery]
  }
}
