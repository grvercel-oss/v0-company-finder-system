"use client"

import { useEffect } from "react"

export function ErrorLogger() {
  useEffect(() => {
    // Track all client-side errors
    const handleError = (event: ErrorEvent) => {
      console.error("[v0] [Client Error]", {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error,
      })
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("[v0] [Promise Rejection]", {
        reason: event.reason,
        message: event.reason?.message,
        stack: event.reason?.stack,
        isInvalidCharacterError: event.reason?.message?.includes("invalid characters"),
      })

      // Suppress InvalidCharacterError to prevent app crashes
      if (event.reason?.message?.includes("invalid characters")) {
        console.warn("[v0] Suppressing InvalidCharacterError - likely from base64 encoding")
        console.warn("[v0] Check: Clerk authentication, API keys with special characters, or image data URIs")
        event.preventDefault()
      }
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    console.log("[v0] Error logger initialized")

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [])

  return null
}
