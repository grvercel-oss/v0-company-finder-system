import { type NextRequest, NextResponse } from "next/server"
import { revealEmail } from "@/lib/hunter"

export async function POST(request: NextRequest) {
  try {
    const { domain, firstName, lastName } = await request.json()

    if (!domain || !firstName || !lastName) {
      return NextResponse.json({ error: "Domain, firstName, and lastName are required" }, { status: 400 })
    }

    const result = await revealEmail(domain, firstName, lastName)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Hunter.io Reveal] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to reveal email" }, { status: 500 })
  }
}
