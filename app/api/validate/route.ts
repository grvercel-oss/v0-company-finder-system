import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { validateCompanyData } from "@/lib/ai-processor"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId } = body

    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 })
    }

    const company = await sql`
      SELECT * FROM companies WHERE id = ${companyId}
    `

    if (company.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const validation = validateCompanyData(company[0])

    return NextResponse.json({
      success: true,
      validation,
      company: company[0],
    })
  } catch (error: any) {
    console.error("[v0] Validate API error:", error)
    return NextResponse.json({ error: error.message || "Validation failed" }, { status: 500 })
  }
}
