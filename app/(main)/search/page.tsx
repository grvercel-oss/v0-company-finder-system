"use client"

import { useState } from "react"
import { SearchBar } from "@/components/search-bar"
import { AdvancedFilters, type FilterOptions } from "@/components/advanced-filters"
import { SearchResults } from "@/components/search-results"
import { CostTracker } from "@/components/cost-tracker"
import type { Company } from "@/lib/db"

interface SearchCost {
  perplexity: {
    input_tokens: number
    output_tokens: number
    cost: number
  }
  openai: {
    input_tokens: number
    output_tokens: number
    cost: number
  }
  total: number
}

export default function SearchPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({})
  const [searchCost, setSearchCost] = useState<SearchCost>()

  const handleSearch = async (query: string) => {
    setIsLoading(true)
    setError(undefined)
    setSearchPerformed(true)
    setSearchCost(undefined)

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, filters }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Search failed")
      }

      const data = await response.json()
      setCompanies(data.companies)
      setSearchCost(data.cost)
    } catch (err: any) {
      setError(err.message || "An error occurred while searching")
      setCompanies([])
    } finally {
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
