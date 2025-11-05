// Generates multiple query variants for parallel searching

export interface QueryVariant {
  variant: string
  focus: string
}

export async function generateQueryVariants(originalQuery: string, count = 4): Promise<QueryVariant[]> {
  console.log(`[v0] Generating ${count} query variants for: "${originalQuery}"`)

  const variants: QueryVariant[] = [
    {
      variant: originalQuery,
      focus: "original query",
    },
    {
      variant: `companies that ${originalQuery}`,
      focus: "company-focused",
    },
    {
      variant: `businesses offering ${originalQuery}`,
      focus: "business-focused",
    },
    {
      variant: `${originalQuery} providers`,
      focus: "provider-focused",
    },
  ]

  // Return only the requested number of variants
  const result = variants.slice(0, count)
  console.log(`[v0] Generated ${result.length} query variants programmatically`)

  return result
}
