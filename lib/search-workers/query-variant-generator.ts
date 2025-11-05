// Generates multiple query variants for parallel searching

export interface QueryVariant {
  variant: string
  focus: string
  suggestedSources: string[]
}

export async function generateQueryVariants(originalQuery: string, count = 4): Promise<QueryVariant[]> {
  console.log(`[v0] Generating ${count} query variants for: "${originalQuery}"`)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  const systemPrompt = `You are a search query optimization expert. Your task is to generate multiple search query variants that approach the same search goal from different angles.

Each variant should:
1. Target the same underlying need but use different terminology
2. Focus on different aspects (company type, technology, use case, industry)
3. Be optimized for different data sources (LinkedIn, Reddit, Clutch, ProductHunt, Crunchbase)

For each variant, suggest which sources would be most effective.`

  const userPrompt = `Generate ${count} different search query variants for: "${originalQuery}"

Each variant should approach the search differently:
- Variant 1: Direct/literal interpretation
- Variant 2: Technology/product focused
- Variant 3: Industry/use-case focused  
- Variant 4: Company-type focused (startups, enterprises, etc.)

For each variant, suggest 2-3 best sources from: LinkedIn, Reddit, Clutch, ProductHunt, Crunchbase

Return a JSON array:
[
  {
    "variant": "search query text",
    "focus": "what this variant emphasizes",
    "suggestedSources": ["LinkedIn", "Clutch"]
  }
]

Return ONLY the JSON array.`

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to generate query variants: ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content

  try {
    let jsonText = content.trim()
    if (jsonText.includes("```json")) {
      const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
      if (match) jsonText = match[1].trim()
    } else if (jsonText.includes("```")) {
      const match = jsonText.match(/```\s*([\s\S]*?)\s*```/)
      if (match) jsonText = match[1].trim()
    }

    const variants = JSON.parse(jsonText)
    console.log(`[v0] Generated ${variants.length} query variants`)
    return variants
  } catch (error) {
    console.error("[v0] Failed to parse query variants, using fallback")
    // Fallback: return original query with different focuses
    return [
      { variant: originalQuery, focus: "direct", suggestedSources: ["LinkedIn", "Clutch", "Crunchbase"] },
      {
        variant: `${originalQuery} startups`,
        focus: "startups",
        suggestedSources: ["ProductHunt", "Crunchbase", "Reddit"],
      },
      {
        variant: `${originalQuery} companies`,
        focus: "established companies",
        suggestedSources: ["LinkedIn", "Clutch"],
      },
      {
        variant: `${originalQuery} tools platforms`,
        focus: "products",
        suggestedSources: ["ProductHunt", "Reddit"],
      },
    ]
  }
}
