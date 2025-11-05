// Generates multiple query variants for parallel searching

export interface QueryVariant {
  variant: string
  focus: string
}

export async function generateQueryVariants(originalQuery: string, count = 4): Promise<QueryVariant[]> {
  console.log(`[v0] Generating ${count} query variants for: "${originalQuery}"`)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  const systemPrompt = `You are a search query optimization expert. Your task is to generate multiple REPHRASED versions of the same search query.

CRITICAL RULES:
1. PRESERVE the exact same intent and meaning as the original query
2. Only use SYNONYMS and alternative phrasings
3. DO NOT change the topic, industry, or type of company being searched
4. DO NOT add new concepts or remove key concepts
5. Keep the same specificity level (location, size, type, etc.)

Example:
Original: "gyms in Santa Cruz de Tenerife"
✅ GOOD variants:
- "fitness centers in Santa Cruz de Tenerife"
- "workout facilities Santa Cruz Tenerife"
- "health clubs Santa Cruz de Tenerife"

❌ BAD variants:
- "sports equipment stores" (changes topic)
- "gyms in Spain" (changes location)
- "fitness startups" (changes company type)`

  const userPrompt = `Generate ${count} different REPHRASED versions of this search query: "${originalQuery}"

Each variant must:
- Mean EXACTLY the same thing as the original
- Use different words/synonyms
- Preserve all key details (location, industry, company type, etc.)

Return a JSON array:
[
  {
    "variant": "rephrased search query",
    "focus": "what synonym/phrasing approach was used"
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
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to generate query variants: ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content

  console.log("[v0] Raw GPT response:", content)

  try {
    let jsonText = content.trim()

    // Remove markdown code blocks
    if (jsonText.includes("```json")) {
      const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
      if (match) jsonText = match[1].trim()
    } else if (jsonText.includes("```")) {
      const match = jsonText.match(/```\s*([\s\S]*?)\s*```/)
      if (match) jsonText = match[1].trim()
    }

    // Remove any text before the first [ and after the last ]
    const arrayStart = jsonText.indexOf("[")
    const arrayEnd = jsonText.lastIndexOf("]")

    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      jsonText = jsonText.substring(arrayStart, arrayEnd + 1)
    }

    console.log("[v0] Extracted JSON text:", jsonText)

    const variants = JSON.parse(jsonText)

    // Validate the structure
    if (!Array.isArray(variants) || variants.length === 0) {
      throw new Error("Invalid variants structure")
    }

    console.log(`[v0] Generated ${variants.length} query variants`)
    return variants
  } catch (error) {
    console.error("[v0] Failed to parse query variants:", error)
    console.error("[v0] Content was:", content)
    return [
      { variant: originalQuery, focus: "original query" },
      { variant: `${originalQuery} list`, focus: "list format" },
      { variant: `find ${originalQuery}`, focus: "action-oriented" },
      { variant: `${originalQuery} directory`, focus: "directory search" },
    ]
  }
}
