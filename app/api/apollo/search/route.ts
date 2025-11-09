import { NextResponse } from "next/server"
import { searchExecutiveContacts } from "@/lib/apollo"

export async function POST(req: Request) {
  try {
    const { domain, companyName } = await req.json()
    const result = await searchExecutiveContacts(domain, companyName)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Apollo Search] Error:", error)

    if (error.message === "UPGRADE_REQUIRED") {
      return NextResponse.json(
        {
          error: "Apollo.io upgrade required",
          message: "The People Search API requires a paid Apollo.io plan. Please upgrade at https://app.apollo.io/",
          upgradeRequired: true,
        },
        { status: 402 },
      )
    }

    return NextResponse.json({ error: error.message || "Failed to search Apollo.io" }, { status: 500 })
  }
}
