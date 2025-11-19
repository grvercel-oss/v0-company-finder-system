"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error details to help debug
    console.error("[v0] [Error Boundary] Caught error:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="text-muted-foreground">
          {error.message || "An unexpected error occurred"}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
