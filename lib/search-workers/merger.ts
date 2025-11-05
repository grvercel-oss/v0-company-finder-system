// Merger/Deduper - handles company deduplication and database saving

import { sql } from "@/lib/db"
import type { CompanyResult } from "./types"

export interface MergeResult {
  company_id: number
  is_new: boolean
  company: any
}

export async function mergeAndSaveCompany(companyResult: CompanyResult, accountId: string): Promise<MergeResult> {
  console.log("[v0] [Merger] Processing company:", companyResult.name)

  try {
    // Check for existing company by domain or name
    const existing = await sql`
      SELECT * FROM companies 
      WHERE (
        (domain IS NOT NULL AND domain = ${companyResult.domain || null})
        OR LOWER(name) = LOWER(${companyResult.name})
      )
      LIMIT 1
    `

    if (existing.length > 0) {
      const company = existing[0]
      console.log("[v0] [Merger] Found existing company:", company.name, "ID:", company.id)

      // Update sources array if not already included
      const sources = company.sources || []
      if (!sources.includes(companyResult.source)) {
        sources.push(companyResult.source)

        await sql`
          UPDATE companies 
          SET sources = ${JSON.stringify(sources)},
              last_updated = now()
          WHERE id = ${company.id}
        `

        console.log("[v0] [Merger] Updated sources for company:", company.id)
      }

      return {
        company_id: company.id,
        is_new: false,
        company: company,
      }
    }

    // Create new company
    console.log("[v0] [Merger] Creating new company:", companyResult.name)

    const inserted = await sql`
      INSERT INTO companies (
        name, domain, description, industry, location, website,
        employee_count, revenue_range, funding_stage,
        technologies, sources, data_quality_score
      ) VALUES (
        ${companyResult.name},
        ${companyResult.domain || null},
        ${companyResult.description || null},
        ${companyResult.industry || null},
        ${companyResult.location || null},
        ${companyResult.website || null},
        ${companyResult.employee_count || null},
        ${companyResult.revenue_range || null},
        ${companyResult.funding_stage || null},
        ${companyResult.technologies || []},
        ${JSON.stringify([companyResult.source])},
        ${companyResult.confidence_score ? Math.round(companyResult.confidence_score * 100) : 50}
      )
      RETURNING *
    `

    const company = inserted[0]
    console.log("[v0] [Merger] Created new company:", company.name, "ID:", company.id)

    return {
      company_id: company.id,
      is_new: true,
      company: company,
    }
  } catch (error: any) {
    console.error("[v0] [Merger] Error processing company:", companyResult.name, error.message)
    throw error
  }
}

export async function linkSearchResult(searchId: string, companyId: number, source: string, score = 0) {
  try {
    await sql`
      INSERT INTO search_results (search_id, company_id, source, score)
      VALUES (${searchId}, ${companyId}, ${source}, ${score})
      ON CONFLICT (search_id, company_id) DO NOTHING
    `

    console.log("[v0] [Merger] Linked search", searchId, "to company", companyId)
  } catch (error: any) {
    console.error("[v0] [Merger] Error linking search result:", error.message)
  }
}
