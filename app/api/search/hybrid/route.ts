import { type NextRequest, NextResponse } from "next/server"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { hybridSearch } from "@/lib/search-workers/embeddings"

export async function GET(request: NextRequest) {
  const accountId = await getAccountIdFromRequest(request)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("query")
  const limit = Number.parseInt(searchParams.get("limit") || "50")

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 })
  }

  try {
    console.log("[v0] Hybrid search request:", query)
    const results = await hybridSearch(query, limit)

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    })
  } catch (error: any) {
    console.error("[v0] Hybrid search error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
