"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, ExternalLink } from "lucide-react"
import Link from "next/link"
import type { Company } from "@/lib/db"

export function RecentCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchRecentCompanies()
  }, [])

  const fetchRecentCompanies = async () => {
    try {
      const response = await fetch("/api/companies?limit=5")
      if (response.ok) {
        const data = await response.json()
        setCompanies(data.companies)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch recent companies:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recently Added</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse" />
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
          <Building2 className="h-5 w-5" />
          Recently Added
        </CardTitle>
        <CardDescription>Latest companies in the database</CardDescription>
      </CardHeader>
      <CardContent>
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No companies yet</p>
        ) : (
          <div className="space-y-3">
            {companies.map((company) => (
              <div key={company.id} className="flex items-start justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{company.name}</p>
                    {company.verified && (
                      <Badge variant="default" className="text-xs">
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {company.industry && (
                      <Badge variant="secondary" className="text-xs">
                        {company.industry}
                      </Badge>
                    )}
                    {company.location && (
                      <Badge variant="outline" className="text-xs">
                        {company.location}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/companies/${company.id}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
