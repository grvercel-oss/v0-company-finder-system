// Fuzzy string matching utility for detecting similar company names

/**
 * Calculate Levenshtein distance between two strings
 * Used to detect similar company names that might be duplicates
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Calculate similarity ratio between two strings (0-1)
 * 1.0 = identical, 0.0 = completely different
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) {
    return 1.0
  }

  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

/**
 * Normalize company name for comparison
 * Removes common suffixes, converts to lowercase, removes special chars
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|ag|sa|srl|bv|nv|pty|pte)\b\.?/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Check if two company names are similar enough to be considered duplicates
 * Returns true if similarity is above threshold (default 0.85)
 */
export function areCompaniesSimilar(name1: string, name2: string, threshold = 0.85): boolean {
  const normalized1 = normalizeCompanyName(name1)
  const normalized2 = normalizeCompanyName(name2)

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return true
  }

  // Calculate similarity
  const similarity = calculateSimilarity(normalized1, normalized2)

  console.log(`[v0] Comparing "${name1}" vs "${name2}": similarity = ${similarity.toFixed(2)}`)

  return similarity >= threshold
}

/**
 * Find if a company name is similar to any in a list of existing names
 * Returns the matching name if found, null otherwise
 */
export function findSimilarCompany(companyName: string, existingNames: string[], threshold = 0.85): string | null {
  for (const existingName of existingNames) {
    if (areCompaniesSimilar(companyName, existingName, threshold)) {
      return existingName
    }
  }
  return null
}
