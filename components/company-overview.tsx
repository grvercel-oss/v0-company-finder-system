"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, DollarSign, TrendingUp, Calendar, MapPin } from "lucide-react"
import type { Company } from "@/lib/db"

interface CompanyOverviewProps {
  company: Company
}

export function CompanyOverview({ company }: CompanyOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Company Overview</CardTitle>
          <CardDescription>AI-generated summary and key information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Summary</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {company.ai_summary || company.description || "No summary available"}
            </p>
          </div>

          {company.description && company.ai_summary && (
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{company.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>Key metrics and information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {company.employee_count && (
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Employees</div>
                <div className="text-sm text-muted-foreground">{company.employee_count}</div>
              </div>
            </div>
          )}

          {company.revenue_range && (
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Revenue Range</div>
                <div className="text-sm text-muted-foreground">{company.revenue_range}</div>
              </div>
            </div>
          )}

          {company.funding_stage && (
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Funding Stage</div>
                <div className="text-sm text-muted-foreground">{company.funding_stage}</div>
              </div>
            </div>
          )}

          {company.total_funding && (
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Total Funding</div>
                <div className="text-sm text-muted-foreground">{company.total_funding}</div>
              </div>
            </div>
          )}

          {company.founded_year && (
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Founded</div>
                <div className="text-sm text-muted-foreground">{company.founded_year}</div>
              </div>
            </div>
          )}

          {company.location && (
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Location</div>
                <div className="text-sm text-muted-foreground">{company.location}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {company.technologies && company.technologies.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Technologies</CardTitle>
            <CardDescription>Tech stack and tools used by this company</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {company.technologies.map((tech) => (
                <Badge key={tech} variant="secondary">
                  {tech}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {company.keywords && company.keywords.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Keywords</CardTitle>
            <CardDescription>Relevant search keywords and tags</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {company.keywords.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
