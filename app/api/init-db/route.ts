import { type NextRequest, NextResponse } from "next/server"
import { initializeDatabase, checkDatabaseSetup } from "@/lib/db-init"

export async function POST(request: NextRequest) {
  console.log("[v0] Database initialization API called")

  try {
    const result = await initializeDatabase()

    if (result.success) {
      const check = await checkDatabaseSetup()
      return NextResponse.json({
        success: true,
        message: "Database initialized successfully",
        setup: check,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: "Failed to initialize database",
        },
        { status: 500 },
      )
    }
  } catch (error: any) {
    console.error("[v0] Database initialization error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  console.log("[v0] Database status check API called")

  try {
    const check = await checkDatabaseSetup()
    return NextResponse.json(check)
  } catch (error: any) {
    console.error("[v0] Database status check error:", error)
    return NextResponse.json(
      {
        isSetup: false,
        missingTables: [],
        error: error.message,
      },
      { status: 500 },
    )
  }
}
