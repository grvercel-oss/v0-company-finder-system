import type { NextRequest } from "next/server"
import { neon } from "@neondatabase/serverless"
import { auth } from "@clerk/nextjs/server"

const sql = neon(process.env.NEON_DATABASE_URL!)

// Safe JSON serializer that handles ALL edge cases
function safeJSONStringify(obj: any): string {
  // Convert to string with replacer that handles problematic values
  const str = JSON.stringify(obj, (key, value) => {
    // Handle strings with special characters
    if (typeof value === "string") {
      // Remove any character that's not printable ASCII or basic Latin
      return value
        .split("")
        .map((char) => {
          const code = char.charCodeAt(0)
          // Keep: space (32) to tilde (126), and extended ASCII (160-255)
          if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
            return char
          }
          // Keep common whitespace
          if (code === 9 || code === 10 || code === 13) {
            return char
          }
          // Replace everything else with space
          return " "
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim()
    }
    // Handle undefined, null, NaN, Infinity
    if (value === undefined || value === null) return null
    if (typeof value === "number" && !isFinite(value)) return 0
    return value
  })

  return str || "{}"
}

// Create a safe Response with explicit headers
function createSafeResponse(data: any, status = 200): Response {
  try {
    const jsonString = safeJSONStringify(data)

    return new Response(jsonString, {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("[v0] [Research API] Error creating response:", error)
    return new Response(JSON.stringify({ error: "Failed to serialize response" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const { id } = params

    console.log("[v0] [Research API] Fetching research for company ID:", id)

    // Get company from database
    const companies = await sql`
      SELECT id, name, domain, website
      FROM companies
      WHERE id = ${id}
    `

    if (companies.length === 0) {
      return new NextResponse(JSON.stringify({ error: "Company not found" }), { status: 404 })
    }

    const company = companies[0]

    console.log(`[v0] [Research API] Fetching fresh research for company: ${company.name}`)

    const mockResearch = {
      companyName: company.name,
      summary: "This is a test response with only ASCII characters to verify the API works correctly.",
      categories: [
        {
          category: "Company Overview",
          content: "Test content with safe ASCII characters only.",
          sources: ["https://example.com"],
        },
      ],
      generatedAt: new Date().toISOString(),
    }

    console.log("[v0] [Research API] Returning mock data for testing")

    return new NextResponse(
      JSON.stringify({
        cached: false,
        data: mockResearch,
        fetchedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    )

    /* COMMENTED OUT FOR TESTING
    const research = await researchCompanyWithCommonCrawlGroq(company.name, company.domain || company.website).catch(
      (err) => {
        console.error("[v0] [Research API] Common Crawl + Groq research failed:", err)
        return {
          companyName: company.name,
          summary: "Research data could not be fetched at this time.",
          categories: [],
          generatedAt: new Date().toISOString(),
        }
      },
    )

    console.log("[v0] [Research API] Research completed, saving to database")

    await sql`
      UPDATE companies
      SET 
        tavily_research = ${JSON.stringify(research)},
        tavily_research_fetched_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `.catch((err) => {
      console.error("[v0] [Research API] Error saving to database:", err)
    })

    console.log(`[v0] [Research API] Successfully saved research for company ${id}`)

    return new NextResponse(JSON.stringify({
      cached: false,
      data: research,
      fetchedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
    */
  } catch (error) {
    console.error("[v0] [Research API] Error fetching company research:", error)
    return new NextResponse(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch company research" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    )
  }
}
