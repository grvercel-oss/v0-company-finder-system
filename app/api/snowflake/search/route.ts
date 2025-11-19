import { NextRequest, NextResponse } from "next/server"
import { searchSnowflakeCompanies, searchSnowflakeCompaniesAdvanced, type SnowflakeCompany } from "@/lib/snowflake-client"
import { sql } from "@/lib/db"

// Convert Snowflake company to our database format
function convertSnowflakeToCompany(sfCompany: SnowflakeCompany, dbId?: number) {
  // Build location from available fields
  const locationParts = [
    sfCompany.CITY,
    sfCompany.PROVINCE,
    sfCompany.COUNTRY
  ].filter(Boolean)
  
  // Get the best domain value
  const domain = sfCompany.COMPANY_DOMAIN || sfCompany.PRIMARY_DOMAIN || null
  
  // Build website URL from domain if available
  let website = null
  if (domain) {
    website = domain.startsWith('http') ? domain : `https://${domain}`
  } else if (sfCompany.LINK) {
    website = sfCompany.LINK
  }
  
  const rawData = {
    snowflake_source: true,
    imported_at: new Date().toISOString(),
    ...sfCompany,
    // Additional structured data for easier access
    company_id: sfCompany.COMPANY_ID,
    ceo: sfCompany.CEO,
    company_type: sfCompany.COMPANY_TYPE,
    company_type_dict: sfCompany.COMPANY_TYPE_DICT,
    contact_address: sfCompany.CONTACT_ADDRESS,
    register_address: sfCompany.REGISTER_ADDRESS,
    hq: sfCompany.HQ,
    geo: sfCompany.GEO,
    postcode: sfCompany.POSTCODE,
    link_facebook: sfCompany.LINK_FACEBOOK,
    link_ins: sfCompany.LINK_INS,
    naics_code: sfCompany.NAICS_CODE,
    stock_code: sfCompany.STOCK_CODE,
    stock_exchange: sfCompany.STOCK_EXCHANGE,
    products_offered: sfCompany.PRODUCTS_OFFERED,
    services_offered: sfCompany.SERVICES_OFFERED,
    target_customers: sfCompany.TARGET_CUSTOMERS,
    target_suppliers: sfCompany.TARGET_SUPPLIERS,
    products_needed: sfCompany.PRODUCTS_NEEDED,
    services_needed: sfCompany.SERVICES_NEEDED,
    events_needed: sfCompany.EVENTS_NEEDED,
  }
  
  return {
    id: dbId, // Include database ID if available for linking
    name: sfCompany.COMPANY_NAME || "Unknown",
    domain: domain,
    description: sfCompany.INTRO || null,
    industry: sfCompany.INDUSTRY || sfCompany.INDUSTRY_1 || null,
    size: sfCompany.STAFF_RANGE || null,
    location: locationParts.length > 0 ? locationParts.join(", ") : null,
    founded_year: sfCompany.FOUND_YEAR || null,
    website: website,
    linkedin_url: sfCompany.LINK_LINKEDIN || null,
    twitter_url: sfCompany.LINK_TWITTER || null,
    logo_url: sfCompany.LOGO || null,
    employee_count: sfCompany.STAFF_RANGE || null,
    revenue_range: null, // Not in FlashIntel schema
    technologies: sfCompany.TECH_STACKS ? sfCompany.TECH_STACKS.split(",").map((t) => t.trim()) : [],
    keywords: sfCompany.BUSINESS_KEYWORDS ? sfCompany.BUSINESS_KEYWORDS.split(",").map((k) => k.trim()) : [],
    raw_data: rawData,
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

    const companiesWithIds: any[] = []
    
    if (saveToDb && results.length > 0) {
      console.log("[v0] [Snowflake API] Saving companies to Neon database...")
      
      for (const sfCompany of results) {
        try {
          const dbId = await saveCompanyToNeon(sfCompany)
          companiesWithIds.push(convertSnowflakeToCompany(sfCompany, dbId))
        } catch (error) {
          console.error("[v0] [Snowflake API] Error saving company:", error)
          // Still include company even if save failed, but without ID
          companiesWithIds.push(convertSnowflakeToCompany(sfCompany))
        }
      }
      
      const successCount = companiesWithIds.filter(c => c.id).length
      console.log("[v0] [Snowflake API] Saved", successCount, "companies to Neon")
    } else {
      // If not saving, just convert without IDs
      results.forEach(sfCompany => {
        companiesWithIds.push(convertSnowflakeToCompany(sfCompany))
      })
    }

    return NextResponse.json({
      success: true,
      count: companiesWithIds.length,
      companies: companiesWithIds,
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
