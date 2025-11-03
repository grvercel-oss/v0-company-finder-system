"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { DollarSign, TrendingUp, Search, Calendar } from "lucide-react"

interface CostStats {
  summary: {
    total_searches: number
    total_perplexity_cost: number
    total_openai_cost: number
    total_cost: number
    avg_cost_per_search: number
  }
  byDay: Array<{
    date: string
    searches: number
    daily_cost: number
    perplexity_cost: number
    openai_cost: number
  }>
  expensive: Array<{
    query: string
    total_cost: number
    perplexity_cost: number
    openai_cost: number
    results_count: number
    search_timestamp: string
  }>
}

export function CostAnalytics() {
  const [stats, setStats] = useState<CostStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/stats/costs")
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error("Failed to fetch cost stats:", error)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </Card>
    )
  }

  if (!stats || !stats.summary) {
    return null
  }

  const summary = stats.summary

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Searches</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {Number(summary.total_searches || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${Number(summary.total_cost || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg per Search</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${Number(summary.avg_cost_per_search || 0).toFixed(6)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Last 30 Days</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${stats.byDay.reduce((sum, day) => sum + Number(day.daily_cost || 0), 0).toFixed(4)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Cost Breakdown by Service</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Perplexity AI</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                ${Number(summary.total_perplexity_cost || 0).toFixed(6)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full"
                style={{
                  width: `${((Number(summary.total_perplexity_cost || 0) / Number(summary.total_cost || 1)) * 100).toFixed(1)}%`,
                }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">OpenAI</span>
              <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                ${Number(summary.total_openai_cost || 0).toFixed(6)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-600 dark:bg-purple-400 h-2 rounded-full"
                style={{
                  width: `${((Number(summary.total_openai_cost || 0) / Number(summary.total_cost || 1)) * 100).toFixed(1)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Most Expensive Searches */}
      {stats.expensive && stats.expensive.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Most Expensive Searches</h3>
          <div className="space-y-3">
            {stats.expensive.slice(0, 5).map((search, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{search.query}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(search.search_timestamp).toLocaleDateString()} • {search.results_count} results
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ${Number(search.total_cost).toFixed(6)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    P: ${Number(search.perplexity_cost).toFixed(6)} | O: ${Number(search.openai_cost).toFixed(6)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
