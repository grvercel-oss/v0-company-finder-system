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
  currentBatch: number
  totalBatches: number
  companiesFound: number
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

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete messages (separated by \n\n)
        const messages = buffer.split("\n\n")
        buffer = messages.pop() || "" // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim()) continue

          // Extract data from SSE format: "data: {...}"
          const dataMatch = message.match(/^data: (.+)$/m)
          if (!dataMatch) continue

          try {
            const data = JSON.parse(dataMatch[1])

            switch (data.type) {
              case "start":
                setBatchProgress({
                  currentBatch: 0,
                  totalBatches: data.numBatches,
                  companiesFound: 0,
                  totalCompanies: data.totalCompanies,
                })
                break

              case "batch_start":
                setBatchProgress((prev) => ({
                  currentBatch: data.batchIndex,
                  totalBatches: data.totalBatches,
                  companiesFound: prev?.companiesFound || 0,
                  totalCompanies: prev?.totalCompanies || companyCount,
                }))
                break

              case "company":
                setCompanies((prev) => [...prev, data.company])
                setBatchProgress((prev) => ({
                  currentBatch: prev?.currentBatch || data.batchIndex,
                  totalBatches: prev?.totalBatches || 1,
                  companiesFound: data.totalSaved,
                  totalCompanies: prev?.totalCompanies || companyCount,
                }))
                break

              case "batch_complete":
                console.log(`[v0] Batch ${data.batchIndex} complete`)
                break

              case "batch_error":
                console.error(`[v0] Batch ${data.batchIndex} error:`, data.error)
                break

              case "complete":
                console.log(`[v0] Search complete: ${data.totalSaved} companies`)
                setIsLoading(false)
                setBatchProgress(null)
                await loadSearchHistory()
                break

              case "error":
                throw new Error(data.message)
            }
          } catch (parseError: any) {
            console.error("[v0] Error parsing SSE message:", parseError.message)
            // Don't throw - continue processing other messages
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
                    Batch {batchProgress.currentBatch} of {batchProgress.totalBatches}
                  </span>
                  <span className="text-muted-foreground">
                    {batchProgress.companiesFound} / {batchProgress.totalCompanies} companies found
                  </span>
                </div>
                <Progress 
                  value={(batchProgress.companiesFound / batchProgress.totalCompanies) * 100} 
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
