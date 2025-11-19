"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { SearchResults } from "@/components/search-results"
import { Search, Database, Loader2 } from 'lucide-react'
import type { Company } from "@/lib/db"
import { toast } from "sonner"

export default function SnowflakeSearchPage() {
  const [query, setQuery] = useState("")
  const [industry, setIndustry] = useState("")
  const [location, setLocation] = useState("")
  const [limit, setLimit] = useState(50)
  const [saveToDb, setSaveToDb] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [error, setError] = useState<string>()

  const handleSearch = async () => {
    const trimmedQuery = query.trim()
    const trimmedIndustry = industry.trim()
    const trimmedLocation = location.trim()
    
    if (!trimmedQuery && !trimmedIndustry && !trimmedLocation) {
      toast.error("Please enter at least one search parameter")
      return
    }

    setIsLoading(true)
    setError(undefined)
    setSearchPerformed(true)
    setCompanies([])

    try {
      const params = new URLSearchParams()
      if (trimmedQuery) params.append("query", trimmedQuery)
      if (trimmedIndustry) params.append("industry", trimmedIndustry)
      if (trimmedLocation) params.append("location", trimmedLocation)
      params.append("limit", limit.toString())
      params.append("saveToDb", saveToDb.toString())

      console.log("[v0] [Snowflake Search] Searching with params:", Object.fromEntries(params))

      const response = await fetch(`/api/snowflake/search?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Search failed")
      }

      const data = await response.json()

      console.log("[v0] [Snowflake Search] Found", data.count, "companies")

      setCompanies(data.companies)

      if (saveToDb) {
        toast.success(`Found ${data.count} companies and saved to your database`)
      } else {
        toast.success(`Found ${data.count} companies from Snowflake`)
      }
    } catch (err: any) {
      console.error("[v0] [Snowflake Search] Error:", err)
      setError(err.message || "An error occurred while searching")
      toast.error(err.message || "Search failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSearch()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card shadow-sm">
        <div className="px-8 py-8">
          <div className="max-w-5xl space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Database className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">Snowflake Database Search</h1>
              </div>
              <p className="text-muted-foreground">
                Search millions of companies from the FlashIntel B2B database on Snowflake
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Direct Database Access
                </Badge>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  Instant Results
                </Badge>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                  High Quality Data
                </Badge>
              </div>
              <div className="mt-4 rounded-lg border bg-muted/50 p-4">
                <p className="text-sm font-medium mb-2">💡 Try intelligent search:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => setQuery("AI Startups")}
                    className="rounded bg-background px-2 py-1 hover:bg-accent transition-colors cursor-pointer"
                  >
                    "AI Startups"
                  </button>
                  <button
                    onClick={() => {
                      setQuery("SaaS companies")
                      setLocation("San Francisco")
                    }}
                    className="rounded bg-background px-2 py-1 hover:bg-accent transition-colors cursor-pointer"
                  >
                    "SaaS companies in San Francisco"
                  </button>
                  <button
                    onClick={() => setQuery("Fintech enterprises")}
                    className="rounded bg-background px-2 py-1 hover:bg-accent transition-colors cursor-pointer"
                  >
                    "Fintech enterprises"
                  </button>
                  <button
                    onClick={() => setQuery("Machine Learning startups")}
                    className="rounded bg-background px-2 py-1 hover:bg-accent transition-colors cursor-pointer"
                  >
                    "Machine Learning startups"
                  </button>
                  <button
                    onClick={() => setQuery("Blockchain companies")}
                    className="rounded bg-background px-2 py-1 hover:bg-accent transition-colors cursor-pointer"
                  >
                    "Blockchain companies"
                  </button>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Search Parameters</CardTitle>
                <CardDescription>Enter company name, industry, or location to search</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="query">Company Name or Keywords</Label>
                    <Input
                      id="query"
                      placeholder="e.g., Apple, Microsoft, tech startup..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      placeholder="e.g., Technology, Healthcare, Finance..."
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g., San Francisco, New York, USA..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="limit">Results Limit</Label>
                    <Input
                      id="limit"
                      type="number"
                      min="1"
                      max="500"
                      value={limit}
                      onChange={(e) => setLimit(Number.parseInt(e.target.value) || 50)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="saveToDb"
                    checked={saveToDb}
                    onCheckedChange={(checked) => setSaveToDb(checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="saveToDb" className="text-sm font-normal cursor-pointer">
                    Save results to my database for future use
                  </Label>
                </div>

                <Button onClick={handleSearch} disabled={isLoading} className="w-full" size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Searching Snowflake...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Search Database
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        <SearchResults companies={companies} isLoading={isLoading} error={error} searchPerformed={searchPerformed} />
      </div>
    </div>
  )
}
