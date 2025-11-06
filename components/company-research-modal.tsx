"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, Calendar, Sparkles, AlertCircle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
}

interface TavilyResearchData {
  query: string
  answer: string
  images: string[]
  results: TavilySearchResult[]
}

interface CompanyResearchModalProps {
  companyId: number
  companyName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompanyResearchModal({ companyId, companyName, open, onOpenChange }: CompanyResearchModalProps) {
  const [loading, setLoading] = useState(false)
  const [research, setResearch] = useState<TavilyResearchData | null>(null)
  const [cached, setCached] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchResearch = async () => {
    console.log("[v0] Fetching research for company:", companyId, companyName)
    setLoading(true)
    setError(null)

    try {
      console.log("[v0] Making API call to /api/companies/" + companyId + "/research")
      const response = await fetch(`/api/companies/${companyId}/research`)

      console.log("[v0] API response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] API error response:", errorText)
        throw new Error(`Failed to fetch company research: ${response.status}`)
      }

      const data = await response.json()
      console.log("[v0] Research data received:", data)

      setResearch(data.data)
      setCached(data.cached)
      setFetchedAt(data.fetchedAt)
    } catch (err) {
      console.error("[v0] Error fetching research:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
      console.log("[v0] Research fetch completed")
    }
  }

  // Fetch research when modal opens
  useEffect(() => {
    if (open && !research && !loading) {
      console.log("[v0] Modal opened, triggering research fetch")
      fetchResearch()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Latest Research: {companyName}
          </DialogTitle>
          <DialogDescription>
            AI-powered research from Tavily with the latest information about this company
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Researching {companyName}...</p>
              <p className="text-sm text-muted-foreground">
                Tavily is gathering the latest information from across the web
              </p>
              <p className="text-xs text-muted-foreground">This may take 10-30 seconds</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-6 border border-destructive/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Error loading research</p>
                <p className="text-sm mt-1 text-destructive/80">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchResearch} className="mt-3 bg-transparent">
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {research && !loading && (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Cache status */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {cached ? "Cached research from" : "Fresh research from"}{" "}
                {fetchedAt && new Date(fetchedAt).toLocaleString()}
              </div>

              {/* AI Summary */}
              {research.answer && (
                <div className="rounded-lg bg-primary/5 p-4 border border-primary/20">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Summary
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{research.answer}</p>
                </div>
              )}

              {/* Sources */}
              {research.results && research.results.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Sources & Details</h3>
                  <div className="space-y-4">
                    {research.results.map((result, index) => (
                      <div key={index} className="rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="font-medium text-sm flex-1">{result.title}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(result.score * 100)}% match
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{result.content}</p>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                            <ExternalLink className="h-3 w-3" />
                            View Source
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No results message */}
              {research.results && research.results.length === 0 && !research.answer && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No research results found for this company.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
