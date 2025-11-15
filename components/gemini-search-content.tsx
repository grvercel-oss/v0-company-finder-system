"use client"

import { useState } from "react"
import { SearchBar } from "@/components/search-bar"
import { SearchResults } from "@/components/search-results"
import type { Company } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Sparkles } from 'lucide-react'

export function GeminiSearchContent() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [searchPerformed, setSearchPerformed] = useState(false)

  const handleSearch = async (query: string) => {
    setIsLoading(true)
    setError(undefined)
    setSearchPerformed(true)
    setCompanies([])

    try {
      const response = await fetch("/api/gemini-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Search failed")
      }

      setCompanies(data.companies || [])
    } catch (err: any) {
      setError(err.message || "An error occurred while searching")
      setCompanies([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card shadow-sm">
        <div className="px-8 py-8">
          <div className="max-w-5xl space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">Gemini Search</h1>
                <Badge variant="secondary" className="gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  AI-Powered
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Search companies using Gemini 2.0 Flash with Google Search grounding
              </p>
            </div>
            <SearchBar onSearch={handleSearch} isLoading={isLoading} />
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        <SearchResults
          companies={companies}
          isLoading={isLoading}
          error={error}
          searchPerformed={searchPerformed}
        />
      </div>
    </div>
  )
}
