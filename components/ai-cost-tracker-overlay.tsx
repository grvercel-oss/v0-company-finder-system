"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ChevronLeft, RefreshCcw, TrendingUp, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface AICostData {
  totalCost: string
  totalRequests: number
  cost24h: string
  requests24h: number
  modelBreakdown: Array<{
    model: string
    requestCount: number
    totalCost: string
    totalPromptTokens: number
    totalCompletionTokens: number
  }>
  typeBreakdown: Array<{
    type: string
    requestCount: number
    totalCost: string
  }>
}

export function AICostTrackerOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<AICostData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchCostData = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/ai-cost")
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error("[AI Cost Tracker] Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCostData()
    // Auto-refresh every 30 seconds when open
    const interval = setInterval(() => {
      if (isOpen) {
        fetchCostData()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [isOpen])

  return (
    <>
      {/* Floating Button - Always Visible */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={cn("rounded-full w-12 h-12 p-0 shadow-lg transition-all", isOpen && "bg-primary/90")}
          variant={isOpen ? "default" : "outline"}
        >
          {isOpen ? <ChevronLeft className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sliding Panel */}
      <div
        className={cn(
          "fixed left-0 top-0 h-screen w-80 bg-background border-r shadow-xl z-40 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Card className="h-full rounded-none border-0 flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                AI Cost Tracker
              </CardTitle>
              <Button onClick={fetchCostData} variant="ghost" size="sm" disabled={loading} className="h-8 w-8 p-0">
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {!data ? (
              <div className="text-center text-muted-foreground py-8">
                {loading ? "Loading..." : "No data available"}
              </div>
            ) : (
              <>
                {/* Total Cost Card */}
                <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">Total Spent</div>
                  <div className="text-3xl font-bold text-primary">${data.totalCost}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {data.totalRequests.toLocaleString()} requests
                  </div>
                </div>

                {/* 24h Usage */}
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Last 24 Hours</span>
                  </div>
                  <div className="text-xl font-bold">${data.cost24h}</div>
                  <div className="text-xs text-muted-foreground">{data.requests24h} requests</div>
                </div>

                {/* Model Breakdown */}
                <div>
                  <h3 className="text-sm font-medium mb-2">By Model</h3>
                  <div className="space-y-2">
                    {data.modelBreakdown.map((model) => (
                      <div key={model.model} className="bg-muted rounded p-2 text-xs">
                        <div className="font-medium truncate" title={model.model}>
                          {model.model}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-muted-foreground">{model.requestCount} req</span>
                          <span className="font-bold">${model.totalCost}</span>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {(model.totalPromptTokens / 1000).toFixed(1)}K in +{" "}
                          {(model.totalCompletionTokens / 1000).toFixed(1)}K out
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Type Breakdown */}
                <div>
                  <h3 className="text-sm font-medium mb-2">By Usage Type</h3>
                  <div className="space-y-2">
                    {data.typeBreakdown.map((type) => (
                      <div key={type.type} className="bg-muted rounded p-2 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-medium capitalize">{type.type}</div>
                          <div className="text-muted-foreground">{type.requestCount} requests</div>
                        </div>
                        <div className="font-bold">${type.totalCost}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
