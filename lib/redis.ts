import { Redis } from "@upstash/redis"

// Create Redis client using Upstash environment variables
export const redis = new Redis({
  url: process.env.UPSTASH_KV_KV_REST_API_URL!,
  token: process.env.UPSTASH_KV_KV_REST_API_TOKEN!,
})

// Helper functions for email sync tracking
export async function getLastChecked(accountId: string): Promise<number> {
  const timestamp = await redis.get<number>(`last_checked:${accountId}`)
  // Default to 24 hours ago if never checked
  return timestamp || Date.now() - 24 * 60 * 60 * 1000
}

export async function setLastChecked(accountId: string, timestamp: number): Promise<void> {
  await redis.set(`last_checked:${accountId}`, timestamp)
}

// Lock mechanism to prevent concurrent cron runs
export async function acquireCronLock(lockKey: string, ttlSeconds = 120): Promise<boolean> {
  const result = await redis.set(lockKey, Date.now(), {
    nx: true, // Only set if not exists
    ex: ttlSeconds, // Expire after TTL
  })
  return result === "OK"
}

export async function releaseCronLock(lockKey: string): Promise<void> {
  await redis.del(lockKey)
}
