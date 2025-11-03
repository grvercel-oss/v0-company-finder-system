"use client"

import { DollarSign, TrendingUp, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"

interface CostTrackerProps {
  cost?: {
    perplexity: {
      input_tokens: number
      output_tokens: number
      cost: number
    }
    openai: {
      input_tokens: number
      output_tokens: number
      cost: number
    }
    total: number
  }
}

export function CostTracker({ cost }: CostTrackerProps) {
  if (!cost) return null

  return (
    <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Search Cost Breakdown</h3>
      </div>

      <div className="space-y-3">
        {/* Perplexity Cost */}
        <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Perplexity Search</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {cost.perplexity.input_tokens.toLocaleString()} in / {cost.perplexity.output_tokens.toLocaleString()}{" "}
                out tokens
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">${cost.perplexity.cost.toFixed(6)}</p>
          </div>
        </div>

        {/* OpenAI Cost */}
        <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">OpenAI Enrichment</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {cost.openai.input_tokens.toLocaleString()} in / {cost.openai.output_tokens.toLocaleString()} out tokens
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">${cost.openai.cost.toFixed(6)}</p>
          </div>
        </div>

        {/* Total Cost */}
        <div className="flex items-center justify-between p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg border border-emerald-300 dark:border-emerald-700">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Total Search Cost</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${cost.total.toFixed(6)}</p>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 text-center pt-2">
          Cost per company: ${(cost.total / 5).toFixed(6)}
        </p>
      </div>
    </Card>
  )
}
