import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ResearchResult {
  companyName: string
  summary: string
  categories: Array<{
    title: string
    content: string
    sources?: Array<{ title: string; url: string }>
  }>
  generatedAt: string
}

export async function researchCompanyWithOpenAI(companyName: string): Promise<ResearchResult> {
  console.log("[v0] [OpenAI Search] Starting research for:", companyName)

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a company research analyst. Research companies and provide ONLY verified information with source URLs.
          
CRITICAL RULES:
1. Use web search to find REAL, UP-TO-DATE information (prioritize 2024-2025 data)
2. For EVERY fact you state, you MUST include the source URL where you found it
3. If you cannot find verified information, write "Not available" - DO NOT make up data
4. Focus on: Funding rounds, Investors, Valuation, Revenue, Employee count, Recent news

Return JSON format:
{
  "companyName": "string",
  "summary": "2-3 sentence overview",
  "categories": [
    {
      "title": "Funding & Investment",
      "content": "Detailed funding information with amounts, dates, rounds",
      "sources": [{"title": "Source name", "url": "https://..."}]
    },
    {
      "title": "Investors",
      "content": "List of actual investors with their investment rounds",
      "sources": [{"title": "Source name", "url": "https://..."}]
    },
    {
      "title": "Financials",
      "content": "Revenue, valuation, profitability data",
      "sources": [{"title": "Source name", "url": "https://..."}]
    },
    {
      "title": "Recent News",
      "content": "Latest news and developments",
      "sources": [{"title": "Article title", "url": "https://..."}]
    }
  ],
  "generatedAt": "ISO timestamp"
}`,
        },
        {
          role: "user",
          content: `Research ${companyName}. Find their latest funding rounds, investors, valuation, revenue estimates, and recent news. Include source URLs for every claim.`,
        },
      ],
      tools: [{ type: "web_search" }],
      temperature: 0.1, // Low temperature for factual accuracy
      response_format: { type: "json_object" },
    })

    console.log("[v0] [OpenAI] Received response, parsing...")

    const content = response.choices[0]?.message?.content

    if (!content) {
      throw new Error("No content in OpenAI response")
    }

    const research = JSON.parse(content) as ResearchResult

    console.log("[v0] [OpenAI] Successfully parsed research data")

    return {
      ...research,
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[v0] [OpenAI Search] Error:", error)
    throw error
  }
}
