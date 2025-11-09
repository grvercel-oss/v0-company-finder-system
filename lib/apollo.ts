const APOLLO_API_KEY = process.env.APOLLO_API_KEY

interface ApolloContact {
  id: string
  first_name: string
  last_name: string
  name: string
  title: string
  email: string | null
  email_status: string | null
  photo_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  organization: {
    id: string
    name: string
    website_url: string
  } | null
  employment_history: Array<{
    title: string
    current: boolean
  }>
  seniority: string
  departments: string[]
}

interface ApolloSearchResponse {
  people: ApolloContact[]
  breadcrumbs: any[]
  partial_results_only: boolean
  disable_eu_prospecting: boolean
  pagination: {
    page: number
    per_page: number
    total_entries: number
    total_pages: number
  }
}

const EXECUTIVE_TITLES = [
  "CEO",
  "Chief Executive Officer",
  "Founder",
  "Co-Founder",
  "President",
  "CTO",
  "Chief Technology Officer",
  "CFO",
  "Chief Financial Officer",
  "COO",
  "Chief Operating Officer",
  "CMO",
  "Chief Marketing Officer",
  "CPO",
  "Chief Product Officer",
  "CIO",
  "Chief Information Officer",
  "VP",
  "Vice President",
  "SVP",
  "Director",
  "Head of",
  "Managing Director",
]

export async function searchExecutiveContacts(domain: string, companyName: string) {
  if (!APOLLO_API_KEY) {
    throw new Error("Apollo.io API key not configured")
  }

  const params = new URLSearchParams({
    per_page: "25",
    page: "1",
  })

  params.append("organization_domains[]", domain)

  EXECUTIVE_TITLES.forEach((title) => {
    params.append("person_titles[]", title)
  })

  params.append("person_seniorities[]", "executive")
  params.append("person_seniorities[]", "senior")

  const response = await fetch(`https://api.apollo.io/api/v1/mixed_people/search?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": APOLLO_API_KEY,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to search Apollo.io")
  }

  const data: ApolloSearchResponse = await response.json()

  const executives = data.people.map((contact) => ({
    id: contact.id,
    email: contact.email,
    confidence: contact.email_status === "verified" ? 95 : contact.email_status === "guessed" ? 70 : 50,
    first_name: contact.first_name,
    last_name: contact.last_name,
    position: contact.title,
    seniority: contact.seniority || "senior",
    department: contact.departments?.[0] || "",
    linkedin: contact.linkedin_url,
    twitter: contact.twitter_url ? contact.twitter_url.replace("https://twitter.com/", "") : null,
    photo_url: contact.photo_url,
    email_status: contact.email_status,
    organization: contact.organization,
  }))

  executives.sort((a, b) => {
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

    return b.confidence - a.confidence
  })

  return {
    executives,
    domain,
    organization: companyName,
    totalFound: data.pagination.total_entries,
    executivesFound: executives.length,
  }
}

export async function enrichContact(domain: string, firstName: string, lastName: string, email?: string) {
  if (!APOLLO_API_KEY) {
    throw new Error("Apollo.io API key not configured")
  }

  const response = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": APOLLO_API_KEY,
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      organization_name: domain,
      email: email,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to enrich contact")
  }

  const data = await response.json()
  return data.person
}
