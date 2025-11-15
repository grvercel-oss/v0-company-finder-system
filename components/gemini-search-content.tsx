"use client"

import { useState, useEffect } from "react"
import { SearchBar } from "@/components/search-bar"
import { SearchHistory } from "@/components/search-history"
import { SearchResults } from "@/components/search-results"
import type { Company } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Sparkles } from 'lucide-react'

export function GeminiSearchContent() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [searchHistory, setSearchHistory] = useState<any[]>([])

  useEffect(() => {
    loadSearchHistory()
  }, [])

  const loadSearchHistory = async () => {
    try {
      const response = await fetch("/api/search/history?limit=10")
      if (response.ok) {
        const data = await response.json()
        setSearchHistory(data.history || [])
      }
    } catch (err) {
      console.error("[v0] Error loading search history:", err)
    }
  }

  const handleSearch = async (query: string) => {
    setIsLoading(true)
    setError(undefined)
    setSearchPerformed(true)
    setCompanies([])

    try {
      console.log("[v0] Starting Gemini search:", query)

      const response = await fetch("/api/gemini-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Search failed")
      }

      console.log("[v0] Gemini search completed:", data.companies.length, "companies")
      setCompanies(data.companies || [])
      
      loadSearchHistory()
    } catch (err: any) {
      console.error("[v0] Search error:", err)
      setError(err.message || "An error occurred while searching")
      setCompanies([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectHistory = async (searchId: string, query: string) => {
    setIsLoading(true)
    setError(undefined)

    try {
      console.log("[v0] Loading search from history:", searchId)
      const response = await fetch(`/api/search/history/${searchId}`)

      if (!response.ok) {
        throw new Error("Failed to load search")
      }

      const data = await response.json()
      setCompanies(data.companies)
      setSearchPerformed(true)

      console.log("[v0] Loaded", data.companies.length, "companies from history")
    } catch (err: any) {
      console.error("[v0] Error loading search from history:", err)
      setError(err.message || "Failed to load search from history")
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

            {!isLoading && searchHistory.length > 0 && (
              <SearchHistory
                history={searchHistory}
                onSelectHistory={handleSelectHistory}
                isLoading={false}
              />
            )}
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
