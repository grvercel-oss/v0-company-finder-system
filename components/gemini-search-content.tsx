"use client"

import { useState, useEffect } from "react"
import { SearchBar } from "@/components/search-bar"
import { SearchHistory } from "@/components/search-history"
import { SearchResults } from "@/components/search-results"
import type { Company } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Sparkles } from 'lucide-react'
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"

interface BatchProgress {
  attemptNumber: number
  totalSaved: number
  remaining: number
  totalCompanies: number
}

export function GeminiSearchContent() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [searchHistory, setSearchHistory] = useState<any[]>([])
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [totalCompanies, setTotalCompanies] = useState(10)

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

  const handleSearch = async (query: string, companyCount: number) => {
    setIsLoading(true)
    setError(undefined)
    setSearchPerformed(true)
    setCompanies([])
    setBatchProgress(null)
    setTotalCompanies(companyCount)

    try {
      console.log("[v0] Starting Gemini search:", query, "companies:", companyCount)

      const response = await fetch("/api/gemini-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, totalCompanies: companyCount }),
      })

      if (!response.ok) {
        throw new Error("Search request failed")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response stream")
      }

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        const messages = buffer.split("\n\n")
        buffer = messages.pop() || ""

        for (const message of messages) {
          if (!message.trim() || message.trim() === "data: [DONE]") continue

          const lines = message.split("\n")
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue

            const dataStr = line.slice(6)
            if (!dataStr.trim()) continue

            try {
              const data = JSON.parse(dataStr)

              switch (data.type) {
                case "start":
                  setBatchProgress({
                    attemptNumber: 0,
                    totalSaved: 0,
                    remaining: data.totalCompanies,
                    totalCompanies: data.totalCompanies,
                  })
                  break

                case "batch_start":
                  setBatchProgress({
                    attemptNumber: data.attemptNumber,
                    totalSaved: data.totalSaved,
                    remaining: data.remaining,
                    totalCompanies: companyCount,
                  })
                  break

                case "company":
                  setCompanies((prev) => [...prev, data.company])
                  setBatchProgress({
                    attemptNumber: data.attemptNumber,
                    totalSaved: data.totalSaved,
                    remaining: data.remaining,
                    totalCompanies: companyCount,
                  })
                  break

                case "batch_complete":
                  console.log(`[v0] Attempt ${data.attemptNumber} complete, target met: ${data.targetMet}`)
                  break

                case "batch_error":
                  console.error(`[v0] Attempt ${data.attemptNumber} error:`, data.error)
                  break

                case "complete":
                  console.log(`[v0] Search complete: ${data.totalSaved} companies in ${data.attempts} attempts`)
                  setIsLoading(false)
                  setBatchProgress(null)
                  await loadSearchHistory()
                  if (!data.targetMet) {
                    setError(`Found ${data.totalSaved} companies but requested ${companyCount}. Try a broader search query.`)
                  }
                  break

                case "error":
                  throw new Error(data.message)
              }
            } catch (parseError: any) {
              console.error("[v0] Error parsing SSE data:", parseError.message)
            }
          }
        }
      }
    } catch (err: any) {
      console.error("[v0] Search error:", err)
      setError(err.message || "An error occurred while searching")
      setCompanies([])
      setIsLoading(false)
      setBatchProgress(null)
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

            {isLoading && batchProgress && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    Attempt {batchProgress.attemptNumber}
                  </span>
                  <span className="text-muted-foreground">
                    {batchProgress.totalSaved} / {batchProgress.totalCompanies} companies found
                    {batchProgress.remaining > 0 && ` (${batchProgress.remaining} remaining)`}
                  </span>
                </div>
                <Progress 
                  value={(batchProgress.totalSaved / batchProgress.totalCompanies) * 100} 
                  className="h-2"
                />
              </Card>
            )}

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
