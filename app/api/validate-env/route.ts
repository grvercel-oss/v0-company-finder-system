import { NextResponse } from "next/server"
import { validateEnvironmentVariables } from "@/lib/validate-env"

export async function GET() {
  try {
    const isValid = validateEnvironmentVariables()
    
    return NextResponse.json({
      valid: isValid,
      message: isValid 
        ? "All environment variables are valid" 
        : "Some environment variables have invalid characters. Check server logs."
    })
  } catch (error: any) {
    console.error("[v0] [Env Validation] Error:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
