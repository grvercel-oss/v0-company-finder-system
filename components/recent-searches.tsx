"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Search } from "lucide-react"
import type { SearchHistory } from "@/lib/db"

export function RecentSearches() {
  const [searches, setSearches] = useState<SearchHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchRecentSearches()
  }, [])

  const fetchRecentSearches = async () => {
    try {
      const response = await fetch("/api/stats/recent-searches")
      if (response.ok) {
        const data = await response.json()
        setSearches(data.searches)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch recent searches:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Searches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Recent Searches
        </CardTitle>
        <CardDescription>Latest company search queries</CardDescription>
      </CardHeader>
      <CardContent>
        {searches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No searches yet</p>
        ) : (
          <div className="space-y-3">
            {searches.map((search) => (
              <div key={search.id} className="flex items-start justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{search.query}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {new Date(search.search_timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary">{search.results_count || 0} results</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
