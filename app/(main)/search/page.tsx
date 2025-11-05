"use client"

import { useState } from "react"
import { SearchBar } from "@/components/search-bar"
import { AdvancedFilters, type FilterOptions } from "@/components/advanced-filters"
import { SearchResults } from "@/components/search-results"
import { CostTracker } from "@/components/cost-tracker"
import { SearchProgress } from "@/components/search-progress"
import type { Company } from "@/lib/db"

interface SearchCost {
  perplexity?: {
    input_tokens: number
    output_tokens: number
    cost: number
  }
  openai?: {
    input_tokens: number
    output_tokens: number
    cost: number
  }
  workers?: Record<string, { cost: number; tokens?: number }>
  total: number
}

interface WorkerStatus {
  name: string
  status: "pending" | "running" | "completed" | "failed"
  companiesFound: number
}

export default function SearchPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({})
  const [searchCost, setSearchCost] = useState<SearchCost>()
  const [workers, setWorkers] = useState<WorkerStatus[]>([])
  const [icp, setIcp] = useState<any>(null)
  const [searchId, setSearchId] = useState<string>()

  const handleSearch = async (query: string) => {
    setIsLoading(true)
    setError(undefined)
    setSearchPerformed(true)
    setSearchCost(undefined)
    setCompanies([])
    setWorkers([])
    setIcp(null)
    setSearchId(undefined)

    try {
      const params = new URLSearchParams({
        query,
        desired_count: "20",
      })
      const eventSource = new EventSource(`/api/search/stream?${params.toString()}`)

      console.log("[v0] Connecting to search stream...")

      eventSource.addEventListener("icp", (e) => {
        const data = JSON.parse(e.data)
        setIcp(data.icp)
        console.log("[v0] ICP extracted:", data.icp)
      })

      eventSource.addEventListener("search_started", (e) => {
        const data = JSON.parse(e.data)
        setSearchId(data.search_id)
        console.log("[v0] Search started:", data.search_id)
      })

      eventSource.addEventListener("status", (e) => {
        const data = JSON.parse(e.data)
        console.log("[v0] Status:", data.message)
      })

      eventSource.addEventListener("worker_started", (e) => {
        const data = JSON.parse(e.data)
        setWorkers((prev) => {
          const exists = prev.find((w) => w.name === data.worker)
          if (exists) return prev
          return [...prev, { name: data.worker, status: "running", companiesFound: 0 }]
        })
        console.log("[v0] Worker started:", data.worker)
      })

      eventSource.addEventListener("new_company", (e) => {
        const data = JSON.parse(e.data)
        setCompanies((prev) => {
          const exists = prev.find((c) => c.id === data.company.id)
          if (exists) return prev
          return [...prev, data.company]
        })
        setWorkers((prev) =>
          prev.map((w) => (w.name === data.source ? { ...w, companiesFound: w.companiesFound + 1 } : w)),
        )
        console.log("[v0] New company:", data.company.name, "from", data.source)
      })

      eventSource.addEventListener("worker_completed", (e) => {
        const data = JSON.parse(e.data)
        setWorkers((prev) => prev.map((w) => (w.name === data.worker ? { ...w, status: "completed" } : w)))
        console.log("[v0] Worker completed:", data.worker, "found", data.count, "companies")
      })

      eventSource.addEventListener("worker_error", (e) => {
        const data = JSON.parse(e.data)
        setWorkers((prev) => prev.map((w) => (w.name === data.worker ? { ...w, status: "failed" } : w)))
        console.error("[v0] Worker error:", data.worker, data.error)
      })

      eventSource.addEventListener("search_completed", (e) => {
        const data = JSON.parse(e.data)
        console.log("[v0] Search completed:", data.search_id)
        setIsLoading(false)
        eventSource.close()
      })

      eventSource.addEventListener("error", (e) => {
        console.error("[v0] EventSource error:", e)
        setError("Connection to search stream lost. Please try again.")
        setIsLoading(false)
        eventSource.close()
      })

      eventSource.onerror = (e) => {
        console.error("[v0] EventSource connection error:", e)
        setError("Failed to connect to search stream. Please try again.")
        setIsLoading(false)
        eventSource.close()
      }
    } catch (err: any) {
      console.error("[v0] Search error:", err)
      setError(err.message || "An error occurred while searching")
      setCompanies([])
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2">Company Finder</h1>
              <p className="text-muted-foreground text-lg">AI-powered company search and intelligence platform</p>
            </div>
            <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            <AdvancedFilters filters={filters} onFiltersChange={setFilters} />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {isLoading && (
          <div className="max-w-4xl mx-auto mb-6">
            <SearchProgress workers={workers} icp={icp} companiesFound={companies.length} />
          </div>
        )}

        {searchCost && !isLoading && (
          <div className="max-w-4xl mx-auto mb-6">
            <CostTracker cost={searchCost} />
          </div>
        )}
        <SearchResults companies={companies} isLoading={isLoading} error={error} searchPerformed={searchPerformed} />
      </div>
    </div>
  )
}
