"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Sparkles, AlertCircle, X, TrendingUp, Users, DollarSign, Globe, Building2, NewspaperIcon, FileText, CheckCircle, ExternalLink, Shield, UserCheck } from 'lucide-react'
import { FundingCharts } from "@/components/funding-charts"

interface ResearchCategory {
  category: string
  content: string
  sources: string[]
}

interface CorporateRegistryData {
  company_name: string
  registry_name: string
  registry_url: string
  registration_id: string
  date_of_incorporation: string
  status: string
  directors: string[]
  major_shareholders: string[]
  financials_summary: string
  source_url: string
  country: string
}

interface CompanyFundingData {
  companyName: string
  funding_rounds: Array<{
    round_type: string
    amount_usd: number
    currency: string
    announced_date: string
    lead_investors: string[]
    other_investors: string[]
    post_money_valuation?: number
    source_url: string
    confidence_score: number
  }>
  total_funding: number
  latest_valuation?: number
  financial_metrics: Array<{
    fiscal_year: number
    fiscal_quarter?: number
    revenue?: number
    profit?: number
    revenue_growth_pct?: number
    user_count?: number
    arr?: number
    mrr?: number
    source: string
    source_url: string
    confidence_score: number
  }>
  all_investors: string[]
  generatedAt: string
}

interface CompanyResearchData {
  companyName: string
  summary: string
  categories: ResearchCategory[]
  generatedAt: string
  registryData?: CorporateRegistryData | null
  funding?: CompanyFundingData
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
      console.log("[v0] [Research Modal] Fetching research for company ID:", companyId)

      const response = await fetch(`/api/companies/${companyId}/research`)

      if (!response.ok) {
        throw new Error(`Failed to fetch research: ${response.statusText}`)
      }

      const data = await response.json()
      
      console.log("[v0] [Research Modal] Received data:", {
        hasData: !!data.data,
        hasFunding: !!data.data?.funding,
        fundingRounds: data.data?.funding?.funding_rounds?.length || 0,
        metrics: data.data?.funding?.financial_metrics?.length || 0
      })

      setResearch(data.data)
      setCached(data.cached)
      setFetchedAt(data.fetchedAt)
    } catch (err) {
      console.error("[v0] [Research Modal] Error:", err)
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

  const extractMetrics = (research: CompanyResearchData) => {
    const metrics = []

    research.categories.forEach((cat) => {
      if (cat.category.toLowerCase().includes("financial")) {
        const fundingMatch = cat.content.match(/\$[\d.]+[MBK]/gi)
        const valuationMatch = cat.content.match(/valued at \$[\d.]+[MBK]/gi)
        if (fundingMatch) metrics.push({ icon: DollarSign, label: "Funding", value: fundingMatch[0] })
        if (valuationMatch)
          metrics.push({ icon: TrendingUp, label: "Valuation", value: valuationMatch[0].replace("valued at ", "") })
      }
      if (cat.category.toLowerCase().includes("industry") || cat.category.toLowerCase().includes("market")) {
        const countryMatch = cat.content.match(/(\d+)\s+countries/i)
        const userMatch = cat.content.match(/(\d+)\s+million/i)
        if (countryMatch) metrics.push({ icon: Globe, label: "Countries", value: countryMatch[1] })
        if (userMatch) metrics.push({ icon: Users, label: "Scale", value: `${userMatch[1]}M+` })
      }
    })

    return metrics.slice(0, 4) // Max 4 metrics
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => onOpenChange(false)} />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex items-center justify-center">
        <div className="w-full max-w-6xl h-full bg-background border rounded-lg shadow-lg flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b bg-muted/30 flex-shrink-0">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{companyName}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    AI-powered research using Google Search + Gemini 2.0
                  </p>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && (
              <div className="flex flex-col items-center justify-center h-full space-y-4 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Researching {companyName}...</p>
                  <p className="text-sm text-muted-foreground">Searching the web with Gemini 2.0</p>
                  <p className="text-xs text-muted-foreground">This may take 30-60 seconds</p>
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
              <div className="p-6 space-y-6">
                {/* Timestamp Badge */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="gap-2">
                    <Calendar className="h-3 w-3" />
                    {cached ? "Cached" : "Fresh"} • {fetchedAt && new Date(fetchedAt).toLocaleString()}
                  </Badge>
                  {!cached && (
                    <Badge variant="default" className="gap-2">
                      <Sparkles className="h-3 w-3" />
                      Latest Data
                    </Badge>
                  )}
                </div>

                {/* Funding & Financial Data Section */}
                {research.funding &&
                  typeof research.funding === "object" &&
                  (research.funding.total_funding > 0 ||
                    (Array.isArray(research.funding.funding_rounds) && research.funding.funding_rounds.length > 0) ||
                    (Array.isArray(research.funding.financial_metrics) &&
                      research.funding.financial_metrics.length > 0)) && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">FUNDING & FINANCIALS</h3>
                      <FundingCharts
                        fundingRounds={
                          Array.isArray(research.funding.funding_rounds) ? research.funding.funding_rounds : []
                        }
                        financialMetrics={
                          Array.isArray(research.funding.financial_metrics) ? research.funding.financial_metrics : []
                        }
                        totalFunding={research.funding.total_funding || 0}
                        latestValuation={research.funding.latest_valuation}
                        allInvestors={
                          Array.isArray(research.funding.all_investors) ? research.funding.all_investors : []
                        }
                      />
                    </div>
                  )}

                {/* Executive Summary */}
                {research.summary && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">EXECUTIVE SUMMARY</h3>
                    <div className="rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 border border-primary/20">
                      <div className="flex gap-3">
                        <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <p className="text-base leading-relaxed">{research.summary}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailed Research */}
                {research.categories && research.categories.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">DETAILED RESEARCH</h3>
                    <div className="grid gap-4">
                      {research.categories.map((category, index) => {
                        let CategoryIcon = Building2
                        if (category.category.toLowerCase().includes("financial")) CategoryIcon = DollarSign
                        if (
                          category.category.toLowerCase().includes("industry") ||
                          category.category.toLowerCase().includes("market")
                        )
                          CategoryIcon = TrendingUp
                        if (category.category.toLowerCase().includes("news")) CategoryIcon = NewspaperIcon

                        return (
                          <div key={index} className="rounded-lg border bg-card p-6 hover:shadow-md transition-all">
                            {/* Category Header */}
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <CategoryIcon className="h-4 w-4 text-primary" />
                              </div>
                              <h4 className="font-semibold text-lg">{category.category}</h4>
                            </div>

                            {/* Content */}
                            <div className="prose prose-sm max-w-none">
                              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {category.content}
                              </p>
                            </div>

                            {/* Sources */}
                            {category.sources && category.sources.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <p className="text-xs font-medium text-muted-foreground mb-2">SOURCES</p>
                                <div className="flex flex-wrap gap-2">
                                  {category.sources.map((source, idx) => (
                                    <a
                                      key={idx}
                                      href={source}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors border inline-flex items-center gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      {new URL(source).hostname.replace("www.", "")}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {research.categories && research.categories.length === 0 && !research.summary && (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No research results found</p>
                    <p className="text-sm mt-1">Try generating new research for this company</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
