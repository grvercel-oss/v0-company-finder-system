"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Sparkles, AlertCircle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ResearchCategory {
  category: string
  content: string
  sources: string[]
}

interface CompanyResearchData {
  companyName: string
  summary: string
  categories: ResearchCategory[]
  generatedAt: string
}

interface CompanyResearchModalProps {
  companyId: number
  companyName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompanyResearchModal({ companyId, companyName, open, onOpenChange }: CompanyResearchModalProps) {
  const [loading, setLoading] = useState(false)
  const [research, setResearch] = useState<CompanyResearchData | null>(null)
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

  useEffect(() => {
    if (!open) {
      // Clear state when modal closes
      setResearch(null)
      setError(null)
      setCached(false)
      setFetchedAt(null)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      console.log("[v0] Modal opened for company:", companyId, companyName)
      fetchResearch()
    }
  }, [open, companyId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Latest Research: {companyName}
          </DialogTitle>
          <DialogDescription>
            AI-powered research using Groq + Brave Search with the latest information about this company
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Researching {companyName}...</p>
              <p className="text-sm text-muted-foreground">Groq is analyzing multiple sources from Brave Search</p>
              <p className="text-xs text-muted-foreground">This may take 20-40 seconds</p>
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

              {/* Executive Summary */}
              {research.summary && (
                <div className="rounded-lg bg-primary/5 p-4 border border-primary/20">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Executive Summary
                  </h3>
                  <p className="text-sm leading-relaxed">{research.summary}</p>
                </div>
              )}

              {/* Research Categories */}
              {research.categories && research.categories.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Detailed Research</h3>
                  <div className="space-y-4">
                    {research.categories.map((category, index) => (
                      <div key={index} className="rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                        <h4 className="font-medium text-base mb-3">{category.category}</h4>
                        <p className="text-sm text-muted-foreground mb-3 leading-relaxed whitespace-pre-wrap">
                          {category.content}
                        </p>

                        {category.sources && category.sources.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-2">Sources:</p>
                            <div className="flex flex-wrap gap-2">
                              {category.sources.map((source, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {source}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No results message */}
              {research.categories && research.categories.length === 0 && !research.summary && (
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
