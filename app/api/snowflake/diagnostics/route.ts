import { NextResponse } from "next/server"
import { checkSnowflakePermissions, listSnowflakeTables } from "@/lib/snowflake-client"

export async function GET() {
  try {
    console.log("[v0] [Snowflake Diagnostics] Running diagnostics")

    const permissions = await checkSnowflakePermissions()

    return NextResponse.json({
      success: true,
      permissions,
      recommendation: permissions.availableTables.length > 0
        ? `Found ${permissions.availableTables.length} table(s). Set SNOWFLAKE_TABLE to one of: ${permissions.availableTables.join(", ")}`
        : "No tables accessible. Check your role permissions in Snowflake.",
    })
  } catch (error: any) {
    console.error("[v0] [Snowflake Diagnostics] Error:", error.message)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        recommendation: "Check your Snowflake credentials and permissions.",
      },
      { status: 500 },
    )
  }
}
