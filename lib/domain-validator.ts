/**
 * Domain validation utility
 * Checks if a domain/website is alive and accessible
 */

export interface DomainValidationResult {
  isAlive: boolean
  statusCode?: number
  error?: string
  redirectUrl?: string
}

/**
 * Validates if a domain is alive by making a HEAD request
 * @param domain - The domain or full URL to validate
 * @returns Validation result with status
 */
export async function validateDomain(domain: string): Promise<DomainValidationResult> {
  if (!domain) {
    return { isAlive: false, error: "No domain provided" }
  }

  // Ensure domain has protocol
  let url = domain
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`
  }

  console.log("[v0] Validating domain:", url)

  try {
    // Use HEAD request for faster validation
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CompanyFinderBot/1.0)",
      },
    })

    clearTimeout(timeoutId)

    const isAlive = response.ok || response.status === 403 // 403 might mean site exists but blocks bots
    console.log("[v0] Domain validation result:", url, "- Status:", response.status, "- Alive:", isAlive)

    return {
      isAlive,
      statusCode: response.status,
      redirectUrl: response.url !== url ? response.url : undefined,
    }
  } catch (error: any) {
    console.log("[v0] Domain validation failed:", url, "- Error:", error.message)

    // Try with http:// if https:// failed
    if (url.startsWith("https://")) {
      const httpUrl = url.replace("https://", "http://")
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(httpUrl, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; CompanyFinderBot/1.0)",
          },
        })

        clearTimeout(timeoutId)

        const isAlive = response.ok || response.status === 403
        console.log("[v0] HTTP fallback validation:", httpUrl, "- Status:", response.status, "- Alive:", isAlive)

        return {
          isAlive,
          statusCode: response.status,
          redirectUrl: response.url !== httpUrl ? response.url : undefined,
        }
      } catch (httpError: any) {
        console.log("[v0] HTTP fallback also failed:", httpUrl, "- Error:", httpError.message)
      }
    }

    return {
      isAlive: false,
      error: error.message,
    }
  }
}

/**
 * Extracts domain from a URL
 */
export function extractDomain(url: string): string {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}
