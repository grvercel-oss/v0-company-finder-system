import { type NextRequest, NextResponse } from "next/server"
import { processCompany, batchProcessCompanies, findCompaniesNeedingEnrichment } from "@/lib/ai-processor"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, companyIds, mode } = body

    // Single company processing
    if (companyId) {
      const result = await processCompany(companyId)
      return NextResponse.json(result)
    }

    // Batch processing
    if (companyIds && Array.isArray(companyIds)) {
      const result = await batchProcessCompanies(companyIds)
      return NextResponse.json(result)
    }

    // Auto-process companies needing enrichment
    if (mode === "auto") {
      const companies = await findCompaniesNeedingEnrichment(50)
      const companyIds = companies.map((c: any) => c.id)
      const result = await batchProcessCompanies(companyIds)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 })
  } catch (error: any) {
    console.error("[v0] Process API error:", error)
    return NextResponse.json({ error: error.message || "Processing failed" }, { status: 500 })
  }
}
