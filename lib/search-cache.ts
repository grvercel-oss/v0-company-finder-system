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
  const cached = await redis.get<string>(key)
  return cached ? JSON.parse(cached) : null
}

// Cache company details
export async function cacheCompany(companyId: number, company: any): Promise<void> {
  const key = `company:${companyId}`
  await redis.set(key, JSON.stringify(company), { ex: 604800 }) // 7 days
}

export async function getCachedCompany(companyId: number): Promise<any | null> {
  const key = `company:${companyId}`
  const cached = await redis.get<string>(key)
  return cached ? JSON.parse(cached) : null
}

// Fast initial lookup: Query existing companies from DB
export async function fastInitialLookup(icp: ICP, accountId: string, limit = 20): Promise<any[]> {
  console.log("[v0] Fast initial lookup with ICP:", icp)

  // Build dynamic WHERE conditions
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  // Industry filter
  if (icp.industries && icp.industries.length > 0) {
    conditions.push(`industry = ANY($${paramIndex})`)
    params.push(icp.industries)
    paramIndex++
  }

  // Location filter
  if (icp.locations && icp.locations.length > 0) {
    conditions.push(`location = ANY($${paramIndex})`)
    params.push(icp.locations)
    paramIndex++
  }

  // Employee count filter
  if (icp.employee_range) {
    const [min, max] = icp.employee_range
    if (min !== undefined && max !== undefined) {
      conditions.push(`(
        CASE 
          WHEN employee_count ~ '^[0-9]+-[0-9]+$' THEN 
            CAST(split_part(employee_count, '-', 1) AS INTEGER) >= $${paramIndex}
            AND CAST(split_part(employee_count, '-', 2) AS INTEGER) <= $${paramIndex + 1}
          ELSE FALSE
        END
      )`)
      params.push(min, max)
      paramIndex += 2
    }
  }

  // Keywords filter (search in description, name, keywords)
  if (icp.keywords && icp.keywords.length > 0) {
    const keywordConditions = icp.keywords
      .map((_, i) => {
        const idx = paramIndex + i
        return `(
        LOWER(name) LIKE LOWER($${idx}) OR 
        LOWER(description) LIKE LOWER($${idx}) OR
        EXISTS (SELECT 1 FROM unnest(keywords) k WHERE LOWER(k) LIKE LOWER($${idx}))
      )`
      })
      .join(" OR ")
    conditions.push(`(${keywordConditions})`)
    params.push(...icp.keywords.map((k) => `%${k}%`))
    paramIndex += icp.keywords.length
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const query = `
    SELECT 
      id, name, domain, website, description, industry, location,
      employee_count, revenue_range, funding_stage, total_funding,
      founded_year, logo_url, linkedin_url, twitter_url,
      technologies, keywords, created_at
    FROM companies
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex}
  `
  params.push(limit)

  console.log("[v0] Fast lookup query:", query)
  console.log("[v0] Fast lookup params:", params)

  try {
    const result = await sql.unsafe(query, params)
    console.log("[v0] Fast lookup found", result.length, "companies")
    return result
  } catch (error: any) {
    console.error("[v0] Fast lookup error:", error.message)
    return []
  }
}
