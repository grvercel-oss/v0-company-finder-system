"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Brain, Loader2, CheckCircle2, XCircle, Zap } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ProcessingResult {
  success: boolean
  companyId?: number
  error?: string
  qualityScore: number
}

interface BatchStatus {
  total: number
  processed: number
  successful: number
  failed: number
  results: ProcessingResult[]
}

export function AIProcessingPanel() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<BatchStatus | null>(null)
  const [error, setError] = useState<string>()

  const handleAutoProcess = async () => {
    setIsProcessing(true)
    setError(undefined)
    setStatus(null)

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Processing failed")
      }

      const data = await response.json()
      setStatus(data)
    } catch (err: any) {
      setError(err.message || "An error occurred during processing")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Processing Pipeline
            </CardTitle>
            <CardDescription>Automatically enrich company data with AI-powered insights</CardDescription>
          </div>
          <Button onClick={handleAutoProcess} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Auto-Process
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {status && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{status.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{status.successful}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{status.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>
                  {status.processed} / {status.total}
                </span>
              </div>
              <Progress value={(status.processed / status.total) * 100} />
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {status.results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Company #{result.companyId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <Badge variant="secondary">Quality: {result.qualityScore}%</Badge>
                    ) : (
                      <Badge variant="destructive">{result.error}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!status && !isProcessing && (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Auto-Process" to enrich companies with low quality scores</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
