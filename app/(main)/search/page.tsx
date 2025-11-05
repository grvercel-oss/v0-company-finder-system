"use client"

import { useState, useEffect } from "react"
import { SearchBar } from "@/components/search-bar"
import { AdvancedFilters, type FilterOptions } from "@/components/advanced-filters"
import { SearchResults } from "@/components/search-results"
import { CostTracker } from "@/components/cost-tracker"
import { SearchProgress } from "@/components/search-progress"
import type { Company } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  const [previousSearch, setPreviousSearch] = useState<{
    query: string
    createdAt: string
  } | null>(null)
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(true)
  const [desiredCount, setDesiredCount] = useState<number>(20)
  const [totalCost, setTotalCost] = useState<number>(0)
  const [costPerCompany, setCostPerCompany] = useState<string>("$0.00")

  useEffect(() => {
    let mounted = true

    const loadPreviousSearch = async () => {
      try {
        console.log("[v0] Loading previous search...")
        const response = await fetch("/api/search/latest")

        if (!mounted) return

        if (!response.ok) {
          throw new Error("Failed to load previous search")
        }

        const data = await response.json()

        if (!mounted) return

        if (data.search && data.companies.length > 0) {
          console.log("[v0] Loaded previous search:", data.search.query, "with", data.companies.length, "companies")
          setCompanies(data.companies)
          setSearchPerformed(true)
          setPreviousSearch({
            query: data.search.query,
            createdAt: data.search.createdAt,
          })
          setIcp(data.search.icp)
        }
      } catch (err) {
        console.error("[v0] Error loading previous search:", err)
      } finally {
        if (mounted) {
          setIsLoadingPrevious(false)
        }
      }
    }

    loadPreviousSearch()

    return () => {
      mounted = false
    }
  }, [])

  const handleSearch = async (query: string) => {
    setPreviousSearch(null)
    setIsLoading(true)
    setError(undefined)
    setSearchPerformed(true)
    setSearchCost(undefined)
    setCompanies([])
    setWorkers([])
    setIcp(null)
    setSearchId(undefined)
    setTotalCost(0)
    setCostPerCompany("$0.00")

    try {
      const params = new URLSearchParams({
        query,
        desired_count: desiredCount.toString(),
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

      eventSource.addEventListener("cost_update", (e) => {
        const data = JSON.parse(e.data)
        setTotalCost(data.total_cost)
        console.log("[v0] Cost update:", data.formatted_total)
      })

      eventSource.addEventListener("cost_summary", (e) => {
        const data = JSON.parse(e.data)
        setTotalCost(data.total_cost)
        setCostPerCompany(data.cost_per_company)
        console.log("[v0] Final cost:", data.formatted_total, "for", data.companies_found, "companies")
      })

      eventSource.onerror = (e) => {
        console.error("[v0] EventSource connection error:", e)
        setError("Failed to connect to search stream. Please try again.")
        setCompanies([])
        setIsLoading(false)
      }
    } catch (err: any) {
      console.error("[v0] Search error:", err)
      setError(err.message || "An error occurred while searching")
      setCompanies([])
      setIsLoading(false)
    }
  }

  if (isLoadingPrevious) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h1 className="text-4xl font-bold tracking-tight mb-2">Company Finder</h1>
                <p className="text-muted-foreground text-lg">AI-powered company search and intelligence platform</p>
              </div>
              <div className="animate-pulse">
                <div className="h-12 bg-muted rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="company-count" className="text-sm font-medium whitespace-nowrap">
                  Target companies:
                </Label>
                <Input
                  id="company-count"
                  type="number"
                  min="5"
                  max="100"
                  value={desiredCount}
                  onChange={(e) => setDesiredCount(Number.parseInt(e.target.value) || 20)}
                  className="w-20"
                  disabled={isLoading}
                />
                <span className="text-xs text-muted-foreground">
                  (Search will stop at exactly {desiredCount} companies)
                </span>
              </div>
            </div>
            <AdvancedFilters filters={filters} onFiltersChange={setFilters} />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {previousSearch && !isLoading && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-3 rounded-lg border">
              <Clock className="h-4 w-4" />
              <span>
                Showing results from previous search:{" "}
                <span className="font-medium text-foreground">"{previousSearch.query}"</span>
              </span>
              <Badge variant="outline" className="ml-auto">
                {new Date(previousSearch.createdAt).toLocaleString()}
              </Badge>
            </div>
          </div>
        )}

        {(isLoading || totalCost > 0) && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Search Cost</p>
                  <p className="text-2xl font-bold">${totalCost.toFixed(4)}</p>
                </div>
                {companies.length > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground">Cost per Company</p>
                    <p className="text-lg font-semibold">{costPerCompany}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
