"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface WorkerStatus {
  name: string
  status: "pending" | "running" | "completed" | "failed"
  companiesFound: number
}

interface SearchProgressProps {
  workers: WorkerStatus[]
  icp: any
  companiesFound: number
}

export function SearchProgress({ workers, icp, companiesFound }: SearchProgressProps) {
  const completedWorkers = workers.filter((w) => w.status === "completed").length
  const totalWorkers = workers.length
  const progress = totalWorkers > 0 ? (completedWorkers / totalWorkers) * 100 : 0

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Search in Progress</h3>
          </div>
          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            {companiesFound} companies found
          </Badge>
        </div>

        {/* ICP Display */}
        {icp && (
          <div className="p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ideal Customer Profile</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {icp.industries && icp.industries.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {icp.industries.join(", ")}
                </Badge>
              )}
              {icp.locations && icp.locations.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  📍 {icp.locations.join(", ")}
                </Badge>
              )}
              {icp.companySize && (
                <Badge variant="outline" className="text-xs">
                  👥 {icp.companySize}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Overall Progress</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {completedWorkers} / {totalWorkers} sources
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Worker Status */}
        {workers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Search Sources</p>
            <div className="grid gap-2">
              {workers.map((worker) => (
                <div
                  key={worker.name}
                  className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-900/40 rounded"
                >
                  <div className="flex items-center gap-2">
                    {worker.status === "running" && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                    )}
                    {worker.status === "completed" && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                    {worker.status === "failed" && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                    {worker.status === "pending" && <Clock className="h-4 w-4 text-gray-400" />}
                    <span className="text-sm text-gray-900 dark:text-gray-100">{worker.name}</span>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{worker.companiesFound} found</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
