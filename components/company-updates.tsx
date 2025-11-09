"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Sparkles, DollarSign, TrendingUp, Users, Globe, Building2 } from "lucide-react"
import type { CompanyUpdate } from "@/lib/db"
import { useState } from "react"
import { CompanyResearchModal } from "./company-research-modal"

interface CompanyUpdatesProps {
  updates: CompanyUpdate[]
  companyId: number
  companyName: string
  hasEnrichmentData?: boolean
  enrichmentData?: {
    summary?: string
    extractedInfo?: {
      technologies?: string[]
      keywords?: string[]
      employee_count?: string
      revenue_range?: string
      funding_stage?: string
      total_funding?: string
      founded_year?: number
      headquarters?: string
      ceo_name?: string
      recent_news?: string
      competitors?: string[]
    }
  }
}

export function CompanyUpdates({
  updates,
  companyId,
  companyName,
  hasEnrichmentData = false,
  enrichmentData,
}: CompanyUpdatesProps) {
  const [researchModalOpen, setResearchModalOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Update History</CardTitle>
          <CardDescription>Track changes and updates to company data</CardDescription>
        </CardHeader>
        <CardContent>
          {hasEnrichmentData && enrichmentData ? (
            <div className="space-y-4">
              {/* AI Summary */}
              {enrichmentData.summary && (
                <div className="rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 border border-primary/20">
                  <div className="flex gap-3">
                    <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-2">AI-Generated Summary</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{enrichmentData.summary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Information */}
              {enrichmentData.extractedInfo && (
                <div className="space-y-3">
                  {enrichmentData.extractedInfo.funding_stage && (
                    <div className="flex items-start gap-3 pb-3 border-b">
                      <DollarSign className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Funding Stage</p>
                        <Badge variant="secondary">{enrichmentData.extractedInfo.funding_stage}</Badge>
                        {enrichmentData.extractedInfo.total_funding && (
                          <span className="text-sm ml-2">{enrichmentData.extractedInfo.total_funding}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {enrichmentData.extractedInfo.employee_count && (
                    <div className="flex items-start gap-3 pb-3 border-b">
                      <Users className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Employee Count</p>
                        <p className="text-sm">{enrichmentData.extractedInfo.employee_count}</p>
                      </div>
                    </div>
                  )}

                  {enrichmentData.extractedInfo.headquarters && (
                    <div className="flex items-start gap-3 pb-3 border-b">
                      <Globe className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Headquarters</p>
                        <p className="text-sm">{enrichmentData.extractedInfo.headquarters}</p>
                      </div>
                    </div>
                  )}

                  {enrichmentData.extractedInfo.ceo_name && (
                    <div className="flex items-start gap-3 pb-3 border-b">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">CEO</p>
                        <p className="text-sm">{enrichmentData.extractedInfo.ceo_name}</p>
                      </div>
                    </div>
                  )}

                  {enrichmentData.extractedInfo.technologies &&
                    enrichmentData.extractedInfo.technologies.length > 0 && (
                      <div className="flex items-start gap-3 pb-3 border-b">
                        <TrendingUp className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Technologies</p>
                          <div className="flex flex-wrap gap-1">
                            {enrichmentData.extractedInfo.technologies.slice(0, 8).map((tech, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  {enrichmentData.extractedInfo.competitors && enrichmentData.extractedInfo.competitors.length > 0 && (
                    <div className="flex items-start gap-3 pb-3 border-b">
                      <TrendingUp className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Competitors</p>
                        <div className="flex flex-wrap gap-1">
                          {enrichmentData.extractedInfo.competitors.slice(0, 5).map((competitor, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {competitor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {enrichmentData.extractedInfo.recent_news && (
                    <div className="flex items-start gap-3 pb-3 border-b">
                      <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Recent News</p>
                        <p className="text-sm text-muted-foreground">{enrichmentData.extractedInfo.recent_news}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => setResearchModalOpen(true)} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                View Full Research Report
              </Button>

              {/* Original Updates Section */}
              {updates.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm font-medium mb-4">Recent Updates</p>
                  <div className="space-y-4">
                    {updates.map((update) => (
                      <div key={update.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                        <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {update.update_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(update.updated_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {update.changes && (
                            <div className="text-sm text-muted-foreground">
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                {JSON.stringify(update.changes, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">No enrichment data available yet</p>
              <Button onClick={() => setResearchModalOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Get Info
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyResearchModal
        companyId={companyId}
        companyName={companyName}
        open={researchModalOpen}
        onOpenChange={setResearchModalOpen}
      />
    </>
  )
}
