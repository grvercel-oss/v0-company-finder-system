import { NextRequest, NextResponse } from "next/server"
import { searchSnowflakeCompanies, searchSnowflakeCompaniesAdvanced, type SnowflakeCompany } from "@/lib/snowflake-client"
import { sql } from "@/lib/db"

// Convert Snowflake company to our database format
function convertSnowflakeToCompany(sfCompany: SnowflakeCompany) {
  return {
    name: sfCompany.company_name || "Unknown",
    domain: sfCompany.domain || sfCompany.website || null,
    description: sfCompany.description || null,
    industry: sfCompany.industry || null,
    size: sfCompany.employee_range || null,
    location: [sfCompany.headquarters_city, sfCompany.headquarters_state, sfCompany.headquarters_country]
      .filter(Boolean)
      .join(", ") || null,
    founded_year: sfCompany.founded_year || null,
    website: sfCompany.website || sfCompany.domain || null,
    linkedin_url: sfCompany.linkedin_url || null,
    twitter_url: sfCompany.twitter_url || null,
    logo_url: sfCompany.logo_url || null,
    employee_count: sfCompany.employee_count?.toString() || sfCompany.employee_range || null,
    revenue_range: sfCompany.revenue_range || (sfCompany.revenue ? `$${sfCompany.revenue}` : null),
    technologies: sfCompany.technologies ? sfCompany.technologies.split(",").map((t) => t.trim()) : [],
    keywords: sfCompany.keywords ? sfCompany.keywords.split(",").map((k) => k.trim()) : [],
    raw_data: sfCompany,
    data_quality_score: 85, // Snowflake data is generally high quality
    verified: true,
  }
}

// Save or update company in Neon database
async function saveCompanyToNeon(sfCompany: SnowflakeCompany) {
  try {
    const companyData = convertSnowflakeToCompany(sfCompany)

    // Check if company already exists by domain
    if (companyData.domain) {
      const existing = await sql`
        SELECT id, last_enriched_at 
        FROM companies 
        WHERE domain = ${companyData.domain}
      `

      if (existing.length > 0) {
        const existingCompany = existing[0]
        const enrichedAt = existingCompany.last_enriched_at as Date | null
        const now = new Date()
        const daysSinceEnrich = enrichedAt ? (now.getTime() - new Date(enrichedAt).getTime()) / (1000 * 60 * 60 * 24) : 999

        // Only update if data is older than 30 days
        if (daysSinceEnrich > 30) {
          console.log("[v0] [Snowflake API] Updating existing company:", companyData.name)
          await sql`
            UPDATE companies
            SET 
              name = ${companyData.name},
              description = ${companyData.description},
              industry = ${companyData.industry},
              size = ${companyData.size},
              location = ${companyData.location},
              founded_year = ${companyData.founded_year},
              website = ${companyData.website},
              linkedin_url = ${companyData.linkedin_url},
              twitter_url = ${companyData.twitter_url},
              logo_url = ${companyData.logo_url},
              employee_count = ${companyData.employee_count},
              revenue_range = ${companyData.revenue_range},
              technologies = ${companyData.technologies},
              keywords = ${companyData.keywords},
              raw_data = ${JSON.stringify(companyData.raw_data)},
              data_quality_score = ${companyData.data_quality_score},
              verified = ${companyData.verified},
              last_enriched_at = NOW(),
              last_updated = NOW()
            WHERE id = ${existingCompany.id}
            RETURNING *
          `
        }

        return existingCompany.id
      }
    }

    // Insert new company
    console.log("[v0] [Snowflake API] Inserting new company:", companyData.name)
    const result = await sql`
      INSERT INTO companies (
        name,
        domain,
        description,
        industry,
        size,
        location,
        founded_year,
        website,
        linkedin_url,
        twitter_url,
        logo_url,
        employee_count,
        revenue_range,
        technologies,
        keywords,
        raw_data,
        data_quality_score,
        verified,
        last_enriched_at,
        last_updated,
        created_at
      ) VALUES (
        ${companyData.name},
        ${companyData.domain},
        ${companyData.description},
        ${companyData.industry},
        ${companyData.size},
        ${companyData.location},
        ${companyData.founded_year},
        ${companyData.website},
        ${companyData.linkedin_url},
        ${companyData.twitter_url},
        ${companyData.logo_url},
        ${companyData.employee_count},
        ${companyData.revenue_range},
        ${companyData.technologies},
        ${companyData.keywords},
        ${JSON.stringify(companyData.raw_data)},
        ${companyData.data_quality_score},
        ${companyData.verified},
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING id
    `

    return result[0].id
  } catch (error: any) {
    console.error("[v0] [Snowflake API] Error saving to Neon:", error.message)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("query")
    const industry = searchParams.get("industry")
    const employeeRange = searchParams.get("employeeRange")
    const revenueRange = searchParams.get("revenueRange")
    const location = searchParams.get("location")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const saveToDb = searchParams.get("saveToDb") === "true"

    console.log("[v0] [Snowflake API] Search request:", { query, industry, limit, saveToDb })

    if (!query && !industry && !location) {
      return NextResponse.json({ error: "At least one search parameter is required" }, { status: 400 })
    }

    // Perform Snowflake search
    let results: SnowflakeCompany[]

    if (industry || employeeRange || revenueRange || location) {
      // Advanced search with filters
      results = await searchSnowflakeCompaniesAdvanced({
        query: query || undefined,
        industry: industry || undefined,
        employeeRange: employeeRange || undefined,
        revenueRange: revenueRange || undefined,
        location: location || undefined,
        limit,
      })
    } else {
      // Simple search
      results = await searchSnowflakeCompanies(query!, limit)
    }

    console.log("[v0] [Snowflake API] Found", results.length, "companies from Snowflake")

    // Optionally save to Neon database
    if (saveToDb && results.length > 0) {
      console.log("[v0] [Snowflake API] Saving companies to Neon database...")
      const savedIds = await Promise.allSettled(
        results.map((company) => saveCompanyToNeon(company))
      )

      const successCount = savedIds.filter((r) => r.status === "fulfilled").length
      console.log("[v0] [Snowflake API] Saved", successCount, "companies to Neon")
    }

    // Convert to our format for response
    const companies = results.map(convertSnowflakeToCompany)

    return NextResponse.json({
      success: true,
      count: companies.length,
      companies,
      source: "snowflake",
    })
  } catch (error: any) {
    console.error("[v0] [Snowflake API] Error:", error.message)
    return NextResponse.json(
      {
        error: "Failed to search Snowflake",
        message: error.message,
      },
      { status: 500 }
    )
  }
}
