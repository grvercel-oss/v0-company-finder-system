/**
 * Generate a favicon URL for a company domain using Google's favicon service
 */
export function getFaviconUrl(domain: string | null | undefined, size = 64): string | null {
  if (!domain) return null

  // Remove protocol and path, keep only domain
  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim()

  if (!cleanDomain) return null

  // Use Google's favicon service
  return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=${size}`
}
