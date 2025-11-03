"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Search, TrendingUp, Database } from "lucide-react"

interface Stats {
  totalCompanies: number
  totalSearches: number
  averageQuality: number
  verifiedCompanies: number
}

export function StatsOverview() {
  const [stats, setStats] = useState<Stats>({
    totalCompanies: 0,
    totalSearches: 0,
    averageQuality: 0,
    verifiedCompanies: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats/overview")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const statCards = [
    {
      title: "Total Companies",
      value: stats.totalCompanies,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total Searches",
      value: stats.totalSearches,
      icon: Search,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Average Quality",
      value: `${stats.averageQuality}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Verified Companies",
      value: stats.verifiedCompanies,
      icon: Database,
      color: "text-orange-600",
      bgColor: "bg-orange-500/10",
    },
  ]

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
