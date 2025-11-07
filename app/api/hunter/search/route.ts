import { type NextRequest, NextResponse } from "next/server"
import { searchExecutiveEmails } from "@/lib/hunter"

export async function POST(request: NextRequest) {
  try {
    const { domain, companyName } = await request.json()

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    const result = await searchExecutiveEmails(domain, companyName)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Hunter.io Search] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to search Hunter.io" }, { status: 500 })
  }
}
