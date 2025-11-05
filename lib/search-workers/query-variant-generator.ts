// Generates multiple query variants for parallel searching

export interface QueryVariant {
  variant: string
  focus: string
}

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim()

  // Remove markdown code blocks
  if (cleaned.includes("```json")) {
    const match = cleaned.match(/```json\s*([\s\S]*?)\s*```/)
    if (match) cleaned = match[1].trim()
  } else if (cleaned.includes("```")) {
    const match = cleaned.match(/```\s*([\s\S]*?)\s*```/)
    if (match) cleaned = match[1].trim()
  }

  // Remove everything before the first [ or {
  cleaned = cleaned.replace(/^[^{[]*/, "")

  // Remove everything after the last ] or }
  cleaned = cleaned.replace(/[^}\]]*$/, "")

  return cleaned.trim()
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

RESPONSE FORMAT:
Return ONLY valid JSON. Do not include explanations, comments, or text outside the JSON structure.

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

Return ONLY a JSON array with no additional text:
[
  {
    "variant": "rephrased search query",
    "focus": "what synonym/phrasing approach was used"
  }
]`

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
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to generate query variants: ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content

  console.log("[v0] Raw GPT response:", content.slice(0, 200))

  try {
    const jsonText = cleanJsonResponse(content)
    console.log("[v0] Cleaned JSON:", jsonText.slice(0, 200))

    const parsed = JSON.parse(jsonText)

    let variants: QueryVariant[]
    if (Array.isArray(parsed)) {
      variants = parsed
    } else if (parsed.variants && Array.isArray(parsed.variants)) {
      variants = parsed.variants
    } else {
      throw new Error("Invalid response structure")
    }

    // Validate the structure
    if (variants.length === 0) {
      throw new Error("No variants generated")
    }

    console.log(`[v0] Successfully generated ${variants.length} query variants`)
    return variants
  } catch (error) {
    console.error("[v0] Failed to parse query variants:", error)
    console.error("[v0] Raw content (first 500 chars):", content.slice(0, 500))

    console.log("[v0] Using fallback variants")
    return [
      { variant: originalQuery, focus: "original query" },
      { variant: `${originalQuery} companies`, focus: "explicit companies" },
      { variant: `${originalQuery} businesses`, focus: "businesses variant" },
      { variant: `find ${originalQuery}`, focus: "action-oriented" },
    ]
  }
}
