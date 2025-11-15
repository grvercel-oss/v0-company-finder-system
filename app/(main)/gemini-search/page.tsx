"use client"

import { Suspense } from "react"
import { GeminiSearchContent } from "@/components/gemini-search-content"

export default function GeminiSearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <GeminiSearchContent />
    </Suspense>
  )
}
