// Hunter.io API integration for finding and verifying executive emails

const HUNTER_API_KEY = process.env.HUNTER_API_KEY

interface HunterEmail {
  value: string
  type: string
  confidence: number
  first_name: string
  last_name: string
  position: string
  seniority: string
  department: string
  linkedin: string | null
  twitter: string | null
  phone_number: string | null
  verification: {
    date: string
    status: string
  } | null
  sources: Array<{
    domain: string
    uri: string
    extracted_on: string
    last_seen_on: string
    still_on_page: boolean
  }>
}

interface HunterDomainSearchResponse {
  data: {
    domain: string
    organization: string
    pattern: string
    emails: HunterEmail[]
  }
  meta: {
    results: number
    limit: number
    offset: number
  }
}

// Executive titles and keywords to filter for leadership positions
const EXECUTIVE_KEYWORDS = [
  "ceo",
  "chief executive",
  "founder",
  "co-founder",
  "president",
  "cto",
  "chief technology",
  "chief technical",
  "cfo",
  "chief financial",
  "coo",
  "chief operating",
  "cmo",
  "chief marketing",
  "cpo",
  "chief product",
  "ciso",
  "chief information security",
  "cio",
  "chief information",
  "vp",
  "vice president",
  "svp",
  "senior vice president",
  "evp",
  "executive vice president",
  "director",
  "head of",
  "managing director",
  "general manager",
  "gm",
]

export async function searchExecutiveEmails(domain: string, companyName?: string) {
  if (!HUNTER_API_KEY) {
    throw new Error("Hunter.io API key not configured")
  }

  const params = new URLSearchParams({
    domain: domain,
    api_key: HUNTER_API_KEY,
    limit: "100", // Get as many as possible to find executives
  })

  if (companyName) {
    params.append("company", companyName)
  }

  const response = await fetch(`https://api.hunter.io/v2/domain-search?${params}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.errors?.[0]?.details || "Failed to search Hunter.io")
  }

  const data: HunterDomainSearchResponse = await response.json()

  // Filter for executive positions only
  const executives = data.data.emails.filter((email) => {
    const position = email.position?.toLowerCase() || ""
    return EXECUTIVE_KEYWORDS.some((keyword) => position.includes(keyword))
  })

  // Sort by confidence and seniority
  executives.sort((a, b) => {
    // Prioritize by seniority first
    const seniorityOrder: Record<string, number> = {
      executive: 1,
      senior: 2,
      junior: 3,
    }
    const aSeniority = seniorityOrder[a.seniority] || 99
    const bSeniority = seniorityOrder[b.seniority] || 99

    if (aSeniority !== bSeniority) {
      return aSeniority - bSeniority
    }

    // Then by confidence
    return b.confidence - a.confidence
  })

  return {
    executives,
    domain: data.data.domain,
    organization: data.data.organization,
    totalFound: data.meta.results,
    executivesFound: executives.length,
  }
}

export async function revealEmail(domain: string, firstName: string, lastName: string) {
  if (!HUNTER_API_KEY) {
    throw new Error("Hunter.io API key not configured")
  }

  const params = new URLSearchParams({
    domain: domain,
    first_name: firstName,
    last_name: lastName,
    api_key: HUNTER_API_KEY,
  })

  const response = await fetch(`https://api.hunter.io/v2/email-finder?${params}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.errors?.[0]?.details || "Failed to reveal email")
  }

  const data = await response.json()
  return data.data
}

export async function verifyEmail(email: string) {
  if (!HUNTER_API_KEY) {
    throw new Error("Hunter.io API key not configured")
  }

  const params = new URLSearchParams({
    email: email,
    api_key: HUNTER_API_KEY,
  })

  const response = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.errors?.[0]?.details || "Failed to verify email")
  }

  const data = await response.json()
  return data.data
}
