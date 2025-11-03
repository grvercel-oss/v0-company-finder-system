import { enrichCompanyDataWithOpenAI } from "./openai"
import { sql } from "./db"

export interface ProcessingResult {
  success: boolean
  companyId?: number
  error?: string
  qualityScore: number
}

export interface BatchProcessingStatus {
  total: number
  processed: number
  successful: number
  failed: number
  results: ProcessingResult[]
}

/**
 * Process a single company through the AI enrichment pipeline
 */
export async function processCompany(companyId: number): Promise<ProcessingResult> {
  try {
    // Fetch company data
    const company = await sql`
      SELECT * FROM companies WHERE id = ${companyId}
    `

    if (company.length === 0) {
      return {
        success: false,
        error: "Company not found",
        qualityScore: 0,
      }
    }

    const companyData = company[0]

    // Enrich with AI
    const enrichment = await enrichCompanyDataWithOpenAI(companyData)

    // Update company with enriched data
    await sql`
      UPDATE companies 
      SET 
        ai_summary = ${enrichment.summary},
        technologies = ${enrichment.extractedInfo.technologies || []},
        keywords = ${enrichment.extractedInfo.keywords || []},
        employee_count = COALESCE(${enrichment.extractedInfo.employee_count}, employee_count),
        revenue_range = COALESCE(${enrichment.extractedInfo.revenue_range}, revenue_range),
        funding_stage = COALESCE(${enrichment.extractedInfo.funding_stage}, funding_stage),
        data_quality_score = ${enrichment.quality_score},
        last_updated = CURRENT_TIMESTAMP
      WHERE id = ${companyId}
    `

    // Log the update
    await sql`
      INSERT INTO company_updates (company_id, update_type, changes)
      VALUES (
        ${companyId}, 
        'ai_enrichment',
        ${JSON.stringify({ enrichment, timestamp: new Date().toISOString() })}
      )
    `

    return {
      success: true,
      companyId,
      qualityScore: enrichment.quality_score,
    }
  } catch (error: any) {
    console.error(`[v0] Failed to process company ${companyId}:`, error)
    return {
      success: false,
      companyId,
      error: error.message,
      qualityScore: 0,
    }
  }
}

/**
 * Batch process multiple companies
 */
export async function batchProcessCompanies(companyIds: number[]): Promise<BatchProcessingStatus> {
  const results: ProcessingResult[] = []
  let successful = 0
  let failed = 0

  for (const companyId of companyIds) {
    const result = await processCompany(companyId)
    results.push(result)

    if (result.success) {
      successful++
    } else {
      failed++
    }
  }

  return {
    total: companyIds.length,
    processed: companyIds.length,
    successful,
    failed,
    results,
  }
}

/**
 * Find companies that need enrichment (low quality score or missing AI summary)
 */
export async function findCompaniesNeedingEnrichment(limit = 50) {
  const companies = await sql`
    SELECT id, name, data_quality_score 
    FROM companies 
    WHERE data_quality_score < 70 OR ai_summary IS NULL
    ORDER BY data_quality_score ASC, created_at DESC
    LIMIT ${limit}
  `

  return companies
}

/**
 * Validate company data completeness
 */
export function validateCompanyData(company: any): {
  isValid: boolean
  missingFields: string[]
  score: number
} {
  const requiredFields = ["name", "domain", "description", "industry", "location"]
  const optionalFields = ["website", "employee_count", "founded_year", "technologies", "keywords"]

  const missingFields: string[] = []
  let presentFields = 0

  // Check required fields
  for (const field of requiredFields) {
    if (!company[field]) {
      missingFields.push(field)
    } else {
      presentFields++
    }
  }

  // Check optional fields
  for (const field of optionalFields) {
    if (company[field]) {
      presentFields++
    }
  }

  const totalFields = requiredFields.length + optionalFields.length
  const score = Math.round((presentFields / totalFields) * 100)

  return {
    isValid: missingFields.length === 0,
    missingFields,
    score,
  }
}
