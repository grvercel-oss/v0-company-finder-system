// Clutch Scraper Worker - scrapes clutch.co for company results

import type { SearchWorker, SearchWorkerResult, ICP, CompanyResult } from "./types"
import * as cheerio from "cheerio"

export class ClutchScraperWorker implements SearchWorker {
  name = "Clutch"
  timeout = 30000 // 30 seconds

  async search(queries: string[], icp: ICP): Promise<SearchWorkerResult> {
    const startTime = Date.now()
    console.log("[v0] [Clutch] Starting search with", queries.length, "queries")

    try {
      // Use the first query for Clutch search
      const query = queries[0] || icp.keywords?.join(" ") || icp.description
      console.log("[v0] [Clutch] Searching:", query)

      const searchUrl = `https://clutch.co/search?search=${encodeURIComponent(query)}`

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      })

      if (!response.ok) {
        throw new Error(`Clutch returned ${response.status}`)
      }

      const html = await response.text()
      const companies = this.parseClutchResults(html)

      const duration = Date.now() - startTime
      console.log("[v0] [Clutch] Completed in", duration, "ms with", companies.length, "companies")

      return {
        companies,
        source: this.name,
        duration_ms: duration,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error("[v0] [Clutch] Error:", error.message)

      return {
        companies: [],
        source: this.name,
        duration_ms: duration,
        error: error.message,
      }
    }
  }

  private parseClutchResults(html: string): CompanyResult[] {
    const $ = cheerio.load(html)
    const companies: CompanyResult[] = []

    // Clutch uses different selectors, we need to find the company cards
    // This is a best-effort scraper that may need adjustments based on Clutch's HTML structure
    $(".provider-row, .company-card, [data-content-type='company']").each((_, element) => {
      try {
        const $el = $(element)

        // Extract company name
        const name = $el.find(".company-name, .provider-name, h3 a, h2 a").first().text().trim()
        if (!name) return

        // Extract website
        const websiteLink = $el.find("a[href*='clutch.co/profile']").attr("href") || ""
        const website = websiteLink ? `https://clutch.co${websiteLink}` : ""

        // Extract rating
        const ratingText = $el.find(".rating, .stars, [class*='rating']").first().text().trim()
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/)
        const rating = ratingMatch ? Number.parseFloat(ratingMatch[1]) : undefined

        // Extract reviews count
        const reviewsText = $el.find(".reviews-count, [class*='review']").text().trim()
        const reviewsMatch = reviewsText.match(/(\d+)/)
        const reviewsCount = reviewsMatch ? Number.parseInt(reviewsMatch[1]) : undefined

        // Extract location
        const location = $el.find(".location, .locality, [class*='location']").first().text().trim()

        // Extract category/industry
        const category = $el.find(".category, .service-focus, [class*='category']").first().text().trim()

        // Extract description
        const description = $el.find(".description, .company-description, p").first().text().trim()

        // Extract domain from website if possible
        const domain = this.extractDomain(website)

        companies.push({
          name,
          domain,
          description: description || `${name} - ${category || "Service provider"}`,
          industry: category || "Professional Services",
          location: location || "",
          website,
          source: this.name,
          confidence_score: rating ? rating / 5 : 0.7, // Normalize rating to 0-1
        })

        // Limit to first 10 results
        if (companies.length >= 10) return false
      } catch (error) {
        console.error("[v0] [Clutch] Error parsing company:", error)
      }
    })

    console.log("[v0] [Clutch] Parsed", companies.length, "companies from HTML")
    return companies
  }

  private extractDomain(url: string): string {
    if (!url) return ""
    try {
      // If it's a Clutch profile URL, we can't extract the real domain
      if (url.includes("clutch.co/profile")) {
        return ""
      }
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`)
      return urlObj.hostname.replace("www.", "")
    } catch {
      return ""
    }
  }
}
