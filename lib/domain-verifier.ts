export interface DomainVerificationResult {
  domain: string
  isValid: boolean
  isReachable: boolean
  statusCode?: number
  error?: string
}

export async function verifyDomain(domain: string): Promise<DomainVerificationResult> {
  if (!domain || domain.trim() === "") {
    return {
      domain,
      isValid: false,
      isReachable: false,
      error: "Empty domain",
    }
  }

  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/
  if (!domainRegex.test(domain)) {
    return {
      domain,
      isValid: false,
      isReachable: false,
      error: "Invalid domain format",
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    })

    clearTimeout(timeoutId)

    return {
      domain,
      isValid: true,
      isReachable: response.ok || response.status === 403,
      statusCode: response.status,
    }
  } catch (error: any) {
    return {
      domain,
      isValid: true,
      isReachable: false,
      error: error.message,
    }
  }
}

export async function verifyDomains(domains: string[]): Promise<Map<string, DomainVerificationResult>> {
  const results = await Promise.all(domains.map((domain) => verifyDomain(domain)))
  const resultMap = new Map<string, DomainVerificationResult>()
  results.forEach((result) => {
    resultMap.set(result.domain, result)
  })
  return resultMap
}

export async function filterVerifiedCompanies<T extends { domain: string }>(
  companies: T[],
): Promise<{ verified: T[]; rejected: T[] }> {
  const domains = companies.map((c) => c.domain)
  const verificationResults = await verifyDomains(domains)

  const verified: T[] = []
  const rejected: T[] = []

  for (const company of companies) {
    const result = verificationResults.get(company.domain)
    if (result && result.isValid && result.isReachable) {
      verified.push(company)
    } else {
      rejected.push(company)
    }
  }

  return { verified, rejected }
}

export const filterCompaniesByDomain = filterVerifiedCompanies
