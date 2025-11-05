import { type NextRequest, NextResponse } from "next/server"
import { getAccountIdFromRequest } from "@/lib/rls-helper"
import { batchEmbedCompanies } from "@/lib/search-workers/embeddings"

export async function POST(request: NextRequest) {
  const accountId = await getAccountIdFromRequest(request)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { limit = 100 } = await request.json()

    console.log("[v0] Starting batch embedding job, limit:", limit)
    const embedded = await batchEmbedCompanies(limit)

    return NextResponse.json({
      success: true,
      embedded,
      message: `Successfully embedded ${embedded} companies`,
    })
  } catch (error: any) {
    console.error("[v0] Batch embedding error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
