"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { PieChart } from "lucide-react"

interface IndustryData {
  industry: string
  count: number
  percentage: number
}

export function IndustryBreakdown() {
  const [industries, setIndustries] = useState<IndustryData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchIndustryData()
  }, [])

  const fetchIndustryData = async () => {
    try {
      const response = await fetch("/api/stats/industries")
      if (response.ok) {
        const data = await response.json()
        setIndustries(data.industries)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch industry data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Industry Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
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
          <PieChart className="h-5 w-5" />
          Industry Breakdown
        </CardTitle>
        <CardDescription>Companies by industry sector</CardDescription>
      </CardHeader>
      <CardContent>
        {industries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No industry data available</p>
        ) : (
          <div className="space-y-4">
            {industries.map((industry) => (
              <div key={industry.industry} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{industry.industry || "Unknown"}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{industry.count}</Badge>
                    <span className="text-xs text-muted-foreground">{industry.percentage}%</span>
                  </div>
                </div>
                <Progress value={industry.percentage} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
