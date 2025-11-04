import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest } from "@/lib/rls-helper"

export async function GET(request: NextRequest) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    const searchParams = request.nextUrl.searchParams
    const industry = searchParams.get("industry")
    const location = searchParams.get("location")
    const size = searchParams.get("size")
    const verified = searchParams.get("verified")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    let query = "SELECT * FROM companies WHERE account_id = $1"
    const params: any[] = [accountId]
    let paramIndex = 2

    if (industry) {
      query += ` AND industry = $${paramIndex}`
      params.push(industry)
      paramIndex++
    }

    if (location) {
      query += ` AND location ILIKE $${paramIndex}`
      params.push(`%${location}%`)
      paramIndex++
    }

    if (size) {
      query += ` AND size = $${paramIndex}`
      params.push(size)
      paramIndex++
    }

    if (verified === "true") {
      query += ` AND verified = true`
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const companiesResult = await sql.query(query, params)
    const companies = companiesResult.rows

    let countQuery = "SELECT COUNT(*) as total FROM companies WHERE account_id = $1"
    const countParams: any[] = [accountId]
    let countParamIndex = 2

    if (industry) {
      countQuery += ` AND industry = $${countParamIndex}`
      countParams.push(industry)
      countParamIndex++
    }

    if (location) {
      countQuery += ` AND location ILIKE $${countParamIndex}`
      countParams.push(`%${location}%`)
      countParamIndex++
    }

    if (size) {
      countQuery += ` AND size = $${countParamIndex}`
      countParams.push(size)
      countParamIndex++
    }

    if (verified === "true") {
      countQuery += ` AND verified = true`
    }

    const countResult = await sql.query(countQuery, countParams)
    const total = Number.parseInt(countResult.rows[0].total)

    return NextResponse.json({
      success: true,
      companies,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error: any) {
    console.error("[v0] Companies API error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch companies" }, { status: 500 })
  }
}
