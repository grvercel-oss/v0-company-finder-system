import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAccountIdFromRequest, withRLS } from "@/lib/rls-helper"

// GET user profile
export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request)

    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profiles = await withRLS(accountId, async () => {
      return await sql`
        SELECT * FROM user_profile 
        WHERE account_id = ${accountId}
        LIMIT 1
      `
    })

    if (profiles.length === 0) {
      // Return empty profile if none exists
      return NextResponse.json({ profile: null })
    }

    return NextResponse.json({ profile: profiles[0] })
  } catch (error) {
    console.error("[v0] Error fetching profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

// POST/PUT update user profile
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { full_name, email, phone, company, website, linkedin_url, twitter_url, signature } = body

    const accountId = await getAccountIdFromRequest(request)

    if (!accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await withRLS(accountId, async () => {
      const existing = await sql`
        SELECT id FROM user_profile 
        WHERE account_id = ${accountId}
        LIMIT 1
      `

      if (existing.length > 0) {
        return await sql`
          UPDATE user_profile
          SET 
            full_name = ${full_name || ""},
            email = ${email || ""},
            phone = ${phone || ""},
            company = ${company || ""},
            website = ${website || ""},
            linkedin_url = ${linkedin_url || ""},
            twitter_url = ${twitter_url || ""},
            signature = ${signature || ""},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existing[0].id} AND account_id = ${accountId}
          RETURNING *
        `
      } else {
        return await sql`
          INSERT INTO user_profile (
            account_id, full_name, email, phone, company, website, 
            linkedin_url, twitter_url, signature
          )
          VALUES (
            ${accountId}, ${full_name || ""}, ${email || ""}, ${phone || ""}, 
            ${company || ""}, ${website || ""}, ${linkedin_url || ""}, 
            ${twitter_url || ""}, ${signature || ""}
          )
          RETURNING *
        `
      }
    })

    return NextResponse.json({ profile: result[0] })
  } catch (error) {
    console.error("[v0] Error updating profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
