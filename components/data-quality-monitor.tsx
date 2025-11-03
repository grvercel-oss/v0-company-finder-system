"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"

interface QualityStats {
  averageScore: number
  excellent: number
  good: number
  needsImprovement: number
  total: number
}

export function DataQualityMonitor() {
  const [stats, setStats] = useState<QualityStats>({
    averageScore: 0,
    excellent: 0,
    good: 0,
    needsImprovement: 0,
    total: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchQualityStats()
  }, [])

  const fetchQualityStats = async () => {
    try {
      const response = await fetch("/api/stats/quality")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch quality stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Data Quality Monitor
        </CardTitle>
        <CardDescription>Track the quality and completeness of company data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="text-4xl font-bold mb-2">{stats.averageScore}%</div>
          <div className="text-sm text-muted-foreground">Average Quality Score</div>
          <Progress value={stats.averageScore} className="mt-4" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-500/10 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.excellent}</div>
            <div className="text-xs text-muted-foreground">Excellent (80+)</div>
          </div>

          <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
            <TrendingUp className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.good}</div>
            <div className="text-xs text-muted-foreground">Good (50-79)</div>
          </div>

          <div className="text-center p-4 bg-red-500/10 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.needsImprovement}</div>
            <div className="text-xs text-muted-foreground">Needs Work (&lt;50)</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">Total Companies</span>
          <Badge variant="secondary">{stats.total}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
