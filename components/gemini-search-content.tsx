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
    if (!query || query.trim().length < 3) {
      setError("Please enter a search query with at least 3 characters")
      return
    }

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

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Search failed")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      const foundCompanies: Company[] = []

      if (!reader) {
        throw new Error("No response stream")
      }

      let buffer = ""
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        
        // Keep the last incomplete chunk in buffer
        buffer = lines.pop() || ""

        for (const chunk of lines) {
          if (!chunk.trim()) continue
          
          const eventMatch = chunk.match(/event:\s*(\w+)/)
          const dataMatch = chunk.match(/data:\s*(.+)/)
          
          if (eventMatch && dataMatch) {
            const event = eventMatch[1]
            try {
              const data = JSON.parse(dataMatch[1])
              
              if (event === 'new_company') {
                foundCompanies.push(data.company)
                setCompanies([...foundCompanies])
                console.log("[v0] New company:", data.company.name)
              } else if (event === 'error') {
                throw new Error(data.message)
              } else if (event === 'search_completed') {
                console.log("[v0] Search completed:", data.total, "companies")
              } else if (event === 'status') {
                console.log("[v0] Status:", data.message)
              }
            } catch (e: any) {
              console.error("[v0] Error parsing SSE data:", e.message)
            }
          }
        }
      }

      await loadSearchHistory()
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
