"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, Calendar, Sparkles } from "lucide-react"
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
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/companies/${companyId}/research`)

      if (!response.ok) {
        throw new Error("Failed to fetch company research")
      }

      const data = await response.json()
      setResearch(data.data)
      setCached(data.cached)
      setFetchedAt(data.fetchedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Fetch research when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
    if (newOpen && !research) {
      fetchResearch()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Fetching latest company information...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
            <p className="font-medium">Error loading research</p>
            <p className="text-sm mt-1">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchResearch} className="mt-3 bg-transparent">
              Try Again
            </Button>
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
                  <p className="text-sm leading-relaxed">{research.answer}</p>
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
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
