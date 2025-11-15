"use client"

import { Investor } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, TrendingUp } from 'lucide-react'
import { Button } from "@/components/ui/button"

interface CompanyInvestorsProps {
  investors: Investor[]
}

export function CompanyInvestors({ investors }: CompanyInvestorsProps) {
  if (!investors || investors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Investors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No investor information available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Investors ({investors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {investors.map((investor) => (
            <div
              key={investor.id}
              className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{investor.investor_name}</p>
                  {investor.investor_type && (
                    <Badge variant="secondary" className="text-xs">
                      {investor.investor_type}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {investor.investment_round && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Round:</span> {investor.investment_round}
                    </span>
                  )}
                  {investor.investment_amount && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Amount:</span> {investor.investment_amount}
                    </span>
                  )}
                  {(investor.investment_date || investor.investment_year) && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Date:</span>{" "}
                      {investor.investment_date
                        ? new Date(investor.investment_date).toLocaleDateString()
                        : investor.investment_year}
                    </span>
                  )}
                </div>
              </div>
              {investor.investor_website && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  asChild
                >
                  <a
                    href={investor.investor_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
