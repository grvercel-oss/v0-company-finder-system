"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error with full details
    console.error("[v0] [Global Error] Unhandled error:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
      digest: error.digest,
      isInvalidCharacterError: error.message?.includes("invalid characters"),
    })

    // If it's the InvalidCharacterError, log additional context
    if (error.message?.includes("invalid characters")) {
      console.error("[v0] [Global Error] This appears to be a base64 encoding issue")
      console.error("[v0] [Global Error] Check Clerk configuration, API keys, or image data URIs")
    }
  }, [error])

  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong!</h2>
          <p>{error.message || "An unexpected error occurred"}</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  )
}
