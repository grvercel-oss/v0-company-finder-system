// Email verification utility using hybrid approach
// No AI credits, minimal resources

interface VerificationResult {
  status: "verified" | "unverified" | "invalid"
  reason?: string
}

// List of common disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com",
  "guerrillamail.com",
  "mailinator.com",
  "throwaway.email",
  "10minutemail.com",
  "temp-mail.org",
  "fakeinbox.com",
  "trashmail.com",
  "yopmail.com",
  "maildrop.cc",
])

// Email syntax validation using regex
function validateEmailSyntax(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Check if email is from a disposable domain
function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase()
  return DISPOSABLE_DOMAINS.has(domain)
}

// DNS/MX record validation
async function validateDNS(domain: string): Promise<boolean> {
  try {
    // Use DNS over HTTPS (DoH) to check MX records
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, {
      headers: {
        Accept: "application/dns-json",
      },
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()

    // Check if MX records exist
    return data.Answer && data.Answer.length > 0
  } catch (error) {
    console.error(`[v0] DNS validation failed for ${domain}:`, error)
    return false
  }
}

// Main verification function
export async function verifyEmail(email: string): Promise<VerificationResult> {
  console.log(`[v0] Verifying email: ${email}`)

  // Step 1: Syntax validation
  if (!validateEmailSyntax(email)) {
    console.log(`[v0] Email ${email} failed syntax validation`)
    return {
      status: "invalid",
      reason: "Invalid email format",
    }
  }

  // Step 2: Disposable email check
  if (isDisposableEmail(email)) {
    console.log(`[v0] Email ${email} is from disposable domain`)
    return {
      status: "invalid",
      reason: "Disposable email address",
    }
  }

  // Step 3: DNS/MX validation
  const domain = email.split("@")[1]
  const hasMX = await validateDNS(domain)

  if (!hasMX) {
    console.log(`[v0] Email ${email} failed DNS validation`)
    return {
      status: "unverified",
      reason: "Domain has no mail server",
    }
  }

  console.log(`[v0] Email ${email} passed all checks`)
  return {
    status: "verified",
    reason: "Passed all validation checks",
  }
}

// Batch verification for multiple emails
export async function verifyEmails(emails: string[]): Promise<Map<string, VerificationResult>> {
  const results = new Map<string, VerificationResult>()

  // Process in batches of 10 to avoid overwhelming DNS servers
  const batchSize = 10
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (email) => ({
        email,
        result: await verifyEmail(email),
      })),
    )

    for (const { email, result } of batchResults) {
      results.set(email, result)
    }

    // Small delay between batches to be respectful to DNS servers
    if (i + batchSize < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return results
}
