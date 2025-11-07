"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Sparkles, AlertCircle, X } from "lucide-react"
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
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/companies/${companyId}/research`)

      if (!response.ok) {
        throw new Error(`Failed to fetch company research: ${response.status}`)
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

  useEffect(() => {
    if (!open) {
      setResearch(null)
      setError(null)
      setCached(false)
      setFetchedAt(null)
    } else {
      fetchResearch()
    }
  }, [open, companyId])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => onOpenChange(false)} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[80vh] bg-background border rounded-lg shadow-lg">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b">
            <div className="flex-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Latest Research: {companyName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                AI-powered research using Groq + Brave Search with the latest information about this company
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {loading && (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Researching {companyName}...</p>
                  <p className="text-sm text-muted-foreground">Groq is analyzing multiple sources from Brave Search</p>
                  <p className="text-xs text-muted-foreground">This may take 20-40 seconds</p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-6">
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
              </div>
            )}

            {research && !loading && (
              <ScrollArea className="h-full p-6">
                <div className="space-y-6 pr-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {cached ? "Cached research from" : "Fresh research from"}{" "}
                    {fetchedAt && new Date(fetchedAt).toLocaleString()}
                  </div>

                  {research.summary && (
                    <div className="rounded-lg bg-primary/5 p-4 border border-primary/20">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Executive Summary
                      </h3>
                      <p className="text-sm leading-relaxed">{research.summary}</p>
                    </div>
                  )}

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

                  {research.categories && research.categories.length === 0 && !research.summary && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No research results found for this company.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
