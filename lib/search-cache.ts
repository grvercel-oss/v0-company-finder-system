import { redis } from "./redis"
import { sql } from "./db"
import type { ICP } from "./search-workers/types"
import crypto from "crypto"

// Generate hash from ICP for cache key
export function generateICPHash(icp: ICP): string {
  const normalized = JSON.stringify(icp, Object.keys(icp).sort())
  return crypto.createHash("md5").update(normalized).digest("hex")
}

// Rate limiting: Check if user can perform search
export async function checkRateLimit(accountId: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate_limit:search:${accountId}`
  const limit = 20 // 20 searches per hour
  const window = 3600 // 1 hour in seconds

  const current = await redis.incr(key)

  if (current === 1) {
    await redis.expire(key, window)
  }

  const remaining = Math.max(0, limit - current)

  return {
    allowed: current <= limit,
    remaining,
  }
}

// Cache ICP hash -> company IDs mapping
export async function cacheSearchResults(icpHash: string, companyIds: number[]): Promise<void> {
  const key = `icp:${icpHash}`
  await redis.set(key, JSON.stringify(companyIds), { ex: 86400 }) // 24 hours
}

export async function getCachedSearchResults(icpHash: string): Promise<number[] | null> {
  const key = `icp:${icpHash}`
  try {
    const cached = await redis.get<string>(key)
    if (!cached) return null

    try {
      return JSON.parse(cached)
    } catch (parseError: any) {
      console.error(`[v0] Failed to parse cached search results for key ${key}:`, parseError.message)
      console.error(`[v0] Corrupted cache data (first 100 chars):`, cached.slice(0, 100))
      // Delete corrupted cache entry
      await redis.del(key)
      return null
    }
  } catch (error: any) {
    console.error(`[v0] Error getting cached search results:`, error.message)
    return null
  }
}

// Cache company details
export async function cacheCompany(companyId: number, company: any): Promise<void> {
  const key = `company:${companyId}`
  await redis.set(key, JSON.stringify(company), { ex: 604800 }) // 7 days
}

export async function getCachedCompany(companyId: number): Promise<any | null> {
  const key = `company:${companyId}`
  try {
    const cached = await redis.get<string>(key)
    if (!cached) return null

    try {
      return JSON.parse(cached)
    } catch (parseError: any) {
      console.error(`[v0] Failed to parse cached company for key ${key}:`, parseError.message)
      // Delete corrupted cache entry
      await redis.del(key)
      return null
    }
  } catch (error: any) {
    console.error(`[v0] Error getting cached company:`, error.message)
    return null
  }
}

// Fast initial lookup: Query existing companies from DB
export async function fastInitialLookup(icp: ICP, accountId: string, limit = 20): Promise<any[]> {
  console.log("[v0] Fast initial lookup with ICP:", icp)

  try {
    // Build a simpler query using template literals
    const industryFilter = icp.industries && icp.industries.length > 0 ? icp.industries : null
    const locationFilter = icp.locations && icp.locations.length > 0 ? icp.locations : null
    const keywordPatterns = icp.keywords && icp.keywords.length > 0 ? icp.keywords.map((k) => `%${k}%`) : []

    let result: any[] = []

    if (industryFilter && locationFilter && keywordPatterns.length > 0) {
      // Full filter with industry, location, and keywords
      result = await sql`
        SELECT 
          id, name, domain, website, description, industry, location,
          employee_count, revenue_range, funding_stage, total_funding,
          founded_year, logo_url, linkedin_url, twitter_url,
          technologies, keywords, created_at
        FROM companies
        WHERE industry = ANY(${industryFilter})
          AND location = ANY(${locationFilter})
          AND (
            LOWER(name) LIKE ANY(${keywordPatterns})
            OR LOWER(description) LIKE ANY(${keywordPatterns})
          )
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else if (industryFilter && locationFilter) {
      // Industry and location only
      result = await sql`
        SELECT 
          id, name, domain, website, description, industry, location,
          employee_count, revenue_range, funding_stage, total_funding,
          founded_year, logo_url, linkedin_url, twitter_url,
          technologies, keywords, created_at
        FROM companies
        WHERE industry = ANY(${industryFilter})
          AND location = ANY(${locationFilter})
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else if (keywordPatterns.length > 0) {
      // Keywords only
      result = await sql`
        SELECT 
          id, name, domain, website, description, industry, location,
          employee_count, revenue_range, funding_stage, total_funding,
          founded_year, logo_url, linkedin_url, twitter_url,
          technologies, keywords, created_at
        FROM companies
        WHERE LOWER(name) LIKE ANY(${keywordPatterns})
          OR LOWER(description) LIKE ANY(${keywordPatterns})
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else {
      // No filters, just return recent companies
      result = await sql`
        SELECT 
          id, name, domain, website, description, industry, location,
          employee_count, revenue_range, funding_stage, total_funding,
          founded_year, logo_url, linkedin_url, twitter_url,
          technologies, keywords, created_at
        FROM companies
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    console.log("[v0] Fast lookup found", result.length, "companies")
    return result
  } catch (error: any) {
    console.error("[v0] Fast lookup error:", error.message)
    return []
  }
}

// Domain verification cache helpers
export async function getCachedDomainVerification(domain: string): Promise<boolean | null> {
  const key = `domain:verified:${domain}`
  try {
    const cached = await redis.get<string>(key)
    if (!cached) return null

    try {
      return JSON.parse(cached)
    } catch (parseError: any) {
      console.error(`[v0] Failed to parse cached domain verification for ${domain}:`, parseError.message)
      // Delete corrupted cache entry
      await redis.del(key)
      return null
    }
  } catch (error: any) {
    console.error(`[v0] Error getting cached domain verification:`, error.message)
    return null
  }
}

// Batch domain verification cache
export async function getCachedDomainVerifications(domains: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()

  const keys = domains.map((d) => `domain:verified:${d}`)
  const cached = await Promise.all(keys.map((k) => redis.get<string>(k)))

  cached.forEach((value, index) => {
    if (value !== null) {
      try {
        results.set(domains[index], JSON.parse(value))
      } catch (parseError: any) {
        console.error(`[v0] Failed to parse cached domain verification for ${domains[index]}:`, parseError.message)
        // Skip corrupted entry
      }
    }
  })

  return results
}
