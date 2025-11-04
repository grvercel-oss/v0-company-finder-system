"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CompanyCard } from "@/components/company-card"
import { AdvancedFilters, type FilterOptions } from "@/components/advanced-filters"
import { Building2, Search, Loader2, Plus } from "lucide-react"
import Link from "next/link"
import type { Company } from "@/lib/db"

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid")
  const [filters, setFilters] = useState<FilterOptions>({})
  const [pagination, setPagination] = useState({ offset: 0, limit: 20, total: 0 })
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchCompanies()
  }, [filters, pagination.offset])

  const fetchCompanies = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(pagination.limit),
        offset: String(pagination.offset),
        ...(filters.industry && { industry: filters.industry }),
        ...(filters.location && { location: filters.location }),
        ...(filters.size && { size: filters.size }),
        ...(filters.verifiedOnly && { verified: "true" }),
      })

      const response = await fetch(`/api/companies?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCompanies(data.companies)
        setPagination({
          ...pagination,
          total: data.pagination.total,
        })
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters)
    setPagination({ ...pagination, offset: 0 })
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-2">
                  <Building2 className="h-8 w-8" />
                  Companies
                </h1>
                <p className="text-muted-foreground text-lg">Browse and manage all companies in your database</p>
              </div>
              <Button asChild>
                <Link href="/search">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Companies
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                <Input
                  placeholder="Filter companies by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button variant={viewMode === "grid" ? "default" : "outline"} onClick={() => setViewMode("grid")}>
                  Grid
                </Button>
                <Button variant={viewMode === "table" ? "default" : "outline"} onClick={() => setViewMode("table")}>
                  Table
                </Button>
              </div>
            </div>

            <AdvancedFilters filters={filters} onFiltersChange={handleFilterChange} />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading companies...</p>
          </div>
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No companies found</h3>
              <p className="text-muted-foreground mb-4">
                {pagination.total === 0
                  ? "Start by searching for and adding companies to your database"
                  : "Adjust your filters to find companies"}
              </p>
              <Button asChild>
                <Link href="/search">Search Companies</Link>
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
                {pagination.total} companies
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <CompanyCard key={company.id} company={company} showAddToList={true} />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={pagination.offset === 0}
                onClick={() =>
                  setPagination({
                    ...pagination,
                    offset: Math.max(0, pagination.offset - pagination.limit),
                  })
                }
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={pagination.offset + pagination.limit >= pagination.total}
                onClick={() =>
                  setPagination({
                    ...pagination,
                    offset: pagination.offset + pagination.limit,
                  })
                }
              >
                Next
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Companies List</CardTitle>
              <CardDescription>{pagination.total} companies found</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.industry || "-"}</TableCell>
                      <TableCell>{company.location || "-"}</TableCell>
                      <TableCell>{company.size || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{company.data_quality_score}%</Badge>
                      </TableCell>
                      <TableCell>
                        {company.verified ? <Badge>Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/companies/${company.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  disabled={pagination.offset === 0}
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      offset: Math.max(0, pagination.offset - pagination.limit),
                    })
                  }
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      offset: pagination.offset + pagination.limit,
                    })
                  }
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
