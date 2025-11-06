// Generates multiple query variants for parallel searching

export interface QueryVariant {
  variant: string
  focus: string
}

export async function generateQueryVariants(originalQuery: string, count = 2): Promise<QueryVariant[]> {
  console.log(`[v0] Generating ${count} query variants for: "${originalQuery}"`)

  const variants: QueryVariant[] = [
    {
      variant: originalQuery,
      focus: "Direct search using exact query terms",
    },
    {
      variant: `companies that ${originalQuery.toLowerCase()}`,
      focus: "Company-focused search with business context",
    },
  ]

  const result = variants.slice(0, Math.min(count, 2))
  console.log(`[v0] Generated ${result.length} query variants programmatically`)

  return result
}
