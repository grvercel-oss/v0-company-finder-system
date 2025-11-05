import type { CompanyResult } from "./search-workers/types"

export async function verifyDomain(domain: string): Promise<boolean> {
  if (!domain) return false

  try {
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`https://${cleanDomain}`, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    })

    clearTimeout(timeoutId)
    return response.ok || response.status === 403
  } catch (error) {
    return false
  }
}

export async function verifyDomains(domains: string[], concurrency = 10): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()
  const chunks: string[][] = []

  for (let i = 0; i < domains.length; i += concurrency) {
    chunks.push(domains.slice(i, i + concurrency))
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (domain) => ({
        domain,
        isValid: await verifyDomain(domain),
      })),
    )

    chunkResults.forEach(({ domain, isValid }) => {
      results.set(domain, isValid)
    })
  }

  return results
}

export async function filterVerifiedCompanies(
  companies: CompanyResult[],
): Promise<{ verified: CompanyResult[]; rejected: CompanyResult[] }> {
  const domains = companies.map((c) => c.domain).filter(Boolean) as string[]
  const verificationResults = await verifyDomains(domains)

  const verified: CompanyResult[] = []
  const rejected: CompanyResult[] = []

  for (const company of companies) {
    if (!company.domain) {
      rejected.push(company)
      continue
    }

    const isValid = verificationResults.get(company.domain)
    if (isValid) {
      verified.push(company)
    } else {
      rejected.push(company)
    }
  }

  return { verified, rejected }
}

export const filterCompaniesByDomain = filterVerifiedCompanies
