"use client"

import type React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import type { Company } from "@/lib/db"
import { SearchResultsTable } from "./search-results-table"
import { BulkAddToList } from "./bulk-add-to-list"
import { useState } from "react"

interface SearchResultsProps {
  companies: Company[]
  isLoading: boolean
  error?: string
  searchPerformed: boolean
}

export function SearchResults({ companies, isLoading, error, searchPerformed }: SearchResultsProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([])

  if (isLoading && companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Initializing search...</p>
        <p className="text-sm text-muted-foreground mt-2">Analyzing your query and preparing sources</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!searchPerformed) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Start Your Search</h3>
        <p className="text-muted-foreground">Enter a search query to find companies using AI-powered intelligence</p>
      </div>
    )
  }

  if (companies.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
        <p className="text-muted-foreground">Try adjusting your search query or filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Finding" : "Found"} {companies.length} {companies.length === 1 ? "company" : "companies"}
          {isLoading && "..."}
          {selectedCompanies.length > 0 && ` • ${selectedCompanies.length} selected`}
        </p>
        {selectedCompanies.length > 0 && (
          <BulkAddToList companyIds={selectedCompanies} onComplete={() => setSelectedCompanies([])} />
        )}
      </div>
      <SearchResultsTable
        companies={companies}
        selectedCompanies={selectedCompanies}
        onSelectionChange={setSelectedCompanies}
      />
    </div>
  )
}

function Building2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  )
}
