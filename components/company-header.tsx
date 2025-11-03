"use client"

import { Building2, CheckCircle2, Globe, Linkedin, Twitter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Company } from "@/lib/db"

interface CompanyHeaderProps {
  company: Company
}

export function CompanyHeader({ company }: CompanyHeaderProps) {
  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            {company.logo_url ? (
              <img
                src={company.logo_url || "/placeholder.svg"}
                alt={company.name}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <Building2 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
              {company.verified && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>

            {company.domain && <p className="text-muted-foreground mb-4">{company.domain}</p>}

            <div className="flex flex-wrap gap-2 mb-4">
              {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
              {company.location && <Badge variant="outline">{company.location}</Badge>}
              {company.size && <Badge variant="outline">{company.size} employees</Badge>}
              {company.founded_year && <Badge variant="outline">Founded {company.founded_year}</Badge>}
            </div>

            <div className="flex gap-2">
              {company.website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={company.website} target="_blank" rel="noopener noreferrer">
                    <Globe className="mr-2 h-4 w-4" />
                    Website
                  </a>
                </Button>
              )}
              {company.linkedin_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="mr-2 h-4 w-4" />
                    LinkedIn
                  </a>
                </Button>
              )}
              {company.twitter_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={company.twitter_url} target="_blank" rel="noopener noreferrer">
                    <Twitter className="mr-2 h-4 w-4" />
                    Twitter
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">Data Quality</div>
            <div className="text-2xl font-bold">{company.data_quality_score}%</div>
            <div className="flex items-center gap-1 mt-1">
              <div
                className={`h-2 w-2 rounded-full ${company.data_quality_score >= 80 ? "bg-green-500" : company.data_quality_score >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
              />
              <span className="text-xs text-muted-foreground">
                {company.data_quality_score >= 80 ? "Excellent" : company.data_quality_score >= 50 ? "Good" : "Fair"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
