import type { NextRequest } from "next/server"
import { neon } from "@neondatabase/serverless"
import { researchCompanyWithTavilyAndGroq } from "@/lib/groq-tavily-research"
import { auth } from "@clerk/nextjs/server"
import { trackAIUsage, trackTavilyUsage } from "@/lib/ai-cost-tracker"

const sql = neon(process.env.NEON_DATABASE_URL!)

function deepClean(obj: any): any {
  if (typeof obj === "string") {
    // Character-by-character filtering - only keep safe ASCII
    return Array.from(obj)
      .map((char) => {
        const code = char.charCodeAt(0)
        if (code === 32 || (code >= 33 && code <= 126) || code === 10) {
          return char
        }
        return " "
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim()
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClean(item))
  }

  if (obj !== null && typeof obj === "object") {
    const cleaned: any = {}
    for (const key in obj) {
      cleaned[key] = deepClean(obj[key])
    }
    return cleaned
  }

  return obj
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    }

    const { id } = params

    console.log("[v0] [Research API] Fetching research for company ID:", id)

    const companies = await sql`
      SELECT id, name, domain, website, tavily_research, tavily_research_fetched_at
      FROM companies
      WHERE id = ${id}
    `

    if (companies.length === 0) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    }

    const company = companies[0]

    const cacheExpiry = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const fetchedAt = company.tavily_research_fetched_at ? new Date(company.tavily_research_fetched_at).getTime() : 0

    if (company.tavily_research && now - fetchedAt < cacheExpiry) {
      console.log(`[v0] [Research API] Using cached research for company ${id}`)

      const cleaned = deepClean(company.tavily_research)

      return new Response(
        JSON.stringify({
          cached: true,
          data: cleaned,
          fetchedAt: company.tavily_research_fetched_at,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        },
      )
    }

    console.log(`[v0] [Research API] Fetching fresh research for company: ${company.name}`)

    const research: any = await researchCompanyWithTavilyAndGroq(company.name).catch((err) => {
      console.error("[v0] [Research API] Tavily+Groq research failed:", err)
      return {
        companyName: company.name,
        summary: "Research data could not be fetched at this time.",
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    })

    await trackTavilyUsage({
      sql,
      accountId: userId,
      searchCount: 5,
      generationType: "company_research_tavily",
    })

    const aiTokens = research._usage || { promptTokens: 15000, completionTokens: 5000 }
    await trackAIUsage({
      sql,
      accountId: userId,
      model: "meta-llama/llama-3.3-70b-instruct", // Free model through Vercel AI Gateway
      promptTokens: aiTokens.promptTokens || 0,
      completionTokens: aiTokens.completionTokens || 0,
      generationType: "company_research_free_ai",
    })

    console.log(
      `[v0] [Research API] Tracked AI usage: ~${aiTokens.promptTokens} prompt + ~${aiTokens.completionTokens} completion tokens`,
    )

    delete research._usage

    const cleanedResearch = deepClean(research)

    console.log("[v0] [Research API] Research completed, saving to database")

    await sql`
      UPDATE companies
      SET 
        tavily_research = ${JSON.stringify(cleanedResearch)},
        tavily_research_fetched_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    console.log(`[v0] [Research API] Successfully saved research for company ${id}`)

    return new Response(
      JSON.stringify({
        cached: false,
        data: cleanedResearch,
        fetchedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    )
  } catch (error) {
    console.error("[v0] [Research API] Error fetching company research:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch company research" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    )
  }
}
