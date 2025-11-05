import { sql } from "../db"

// Generate embedding using OpenAI
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 384, // Smaller dimension for faster search
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

// Generate embedding text from company data
export function generateCompanyEmbeddingText(company: any): string {
  const parts = [
    company.name,
    company.description,
    company.industry,
    ...(company.keywords || []),
    ...(company.technologies || []),
  ].filter(Boolean)

  return parts.join(" ")
}

// Embed a single company
export async function embedCompany(companyId: number): Promise<void> {
  console.log("[v0] Embedding company:", companyId)

  // Fetch company data
  const companies = await sql`
    SELECT id, name, description, industry, keywords, technologies
    FROM companies
    WHERE id = ${companyId}
  `

  if (companies.length === 0) {
    throw new Error(`Company ${companyId} not found`)
  }

  const company = companies[0]
  const text = generateCompanyEmbeddingText(company)
  const embedding = await generateEmbedding(text)

  // Update company with embedding
  await sql`
    UPDATE companies
    SET embedding = ${JSON.stringify(embedding)}::vector,
        is_embedded = true
    WHERE id = ${companyId}
  `

  console.log("[v0] Company embedded successfully:", companyId)
}

// Batch embed companies that haven't been embedded yet
export async function batchEmbedCompanies(limit = 100): Promise<number> {
  console.log("[v0] Starting batch embedding, limit:", limit)

  // Get companies without embeddings
  const companies = await sql`
    SELECT id, name, description, industry, keywords, technologies
    FROM companies
    WHERE is_embedded = false OR embedding IS NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  console.log("[v0] Found", companies.length, "companies to embed")

  let embedded = 0
  for (const company of companies) {
    try {
      const text = generateCompanyEmbeddingText(company)
      const embedding = await generateEmbedding(text)

      await sql`
        UPDATE companies
        SET embedding = ${JSON.stringify(embedding)}::vector,
            is_embedded = true
        WHERE id = ${company.id}
      `

      embedded++
      console.log(`[v0] Embedded ${embedded}/${companies.length}: ${company.name}`)

      // Rate limit: wait 100ms between requests
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error: any) {
      console.error(`[v0] Error embedding company ${company.id}:`, error.message)
    }
  }

  console.log("[v0] Batch embedding complete:", embedded, "companies")
  return embedded
}

// Hybrid search: combine vector similarity + keyword search
export async function hybridSearch(query: string, limit = 50, vectorWeight = 0.7, keywordWeight = 0.3): Promise<any[]> {
  console.log("[v0] Hybrid search for:", query)

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query)

  // Hybrid search query
  const results = await sql`
    WITH vector_results AS (
      SELECT 
        id,
        (1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector)) AS similarity
      FROM companies
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 100
    ),
    keyword_results AS (
      SELECT 
        id,
        ts_rank(search_vector, plainto_tsquery('english', ${query})) AS rank
      FROM companies
      WHERE search_vector @@ plainto_tsquery('english', ${query})
      LIMIT 100
    )
    SELECT 
      c.*,
      COALESCE(v.similarity, 0) * ${vectorWeight} + COALESCE(k.rank, 0) * ${keywordWeight} AS score
    FROM companies c
    LEFT JOIN vector_results v ON c.id = v.id
    LEFT JOIN keyword_results k ON c.id = k.id
    WHERE v.id IS NOT NULL OR k.id IS NOT NULL
    ORDER BY score DESC
    LIMIT ${limit}
  `

  console.log("[v0] Hybrid search found", results.length, "results")
  return results
}
