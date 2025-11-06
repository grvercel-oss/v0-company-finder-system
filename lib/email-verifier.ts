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
  "getnada.com",
  "emailondeck.com",
  "sharklasers.com",
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

// Check if email domain looks suspicious
function isSuspiciousDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase()

  // Check for common patterns in fake emails
  if (domain.includes("example.") || domain.includes("test.") || domain.includes("fake.")) {
    return true
  }

  // Check if domain has valid TLD
  const tld = domain.split(".").pop()
  if (!tld || tld.length < 2) {
    return true
  }

  return false
}

// Main verification function - simplified for speed
export async function verifyEmail(email: string): Promise<VerificationResult> {
  console.log(`[v0] [EMAIL-VERIFY] Verifying email: ${email}`)

  // Step 1: Syntax validation
  if (!validateEmailSyntax(email)) {
    console.log(`[v0] [EMAIL-VERIFY] ${email} - INVALID: Bad syntax`)
    return {
      status: "invalid",
      reason: "Invalid email format",
    }
  }

  // Step 2: Disposable email check
  if (isDisposableEmail(email)) {
    console.log(`[v0] [EMAIL-VERIFY] ${email} - INVALID: Disposable domain`)
    return {
      status: "invalid",
      reason: "Disposable email address",
    }
  }

  // Step 3: Suspicious domain check
  if (isSuspiciousDomain(email)) {
    console.log(`[v0] [EMAIL-VERIFY] ${email} - INVALID: Suspicious domain`)
    return {
      status: "invalid",
      reason: "Suspicious email domain",
    }
  }

  // If it passes all checks, mark as verified
  console.log(`[v0] [EMAIL-VERIFY] ${email} - VERIFIED`)
  return {
    status: "verified",
    reason: "Passed validation checks",
  }
}

// Batch verification for multiple emails
export async function verifyEmails(emails: string[]): Promise<Map<string, VerificationResult>> {
  const results = new Map<string, VerificationResult>()

  // Process all emails in parallel since we removed slow DNS checks
  const verificationPromises = emails.map(async (email) => ({
    email,
    result: await verifyEmail(email),
  }))

  const verificationResults = await Promise.all(verificationPromises)

  for (const { email, result } of verificationResults) {
    results.set(email, result)
  }

  return results
}
