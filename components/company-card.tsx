"use client"

import { Building2, MapPin, Users, ExternalLink, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Company } from "@/lib/db"
import { AddToListButton } from "./add-to-list-button"
import { CompanyResearchModal } from "./company-research-modal"
import { useState } from "react"

interface CompanyCardProps {
  company: Company
  showAddToList?: boolean
}

export function CompanyCard({ company, showAddToList = false }: CompanyCardProps) {
  const [researchModalOpen, setResearchModalOpen] = useState(false)

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-xl truncate">{company.name}</CardTitle>
                {company.verified && <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />}
              </div>
              <CardDescription className="line-clamp-2">
                {company.ai_summary || company.description || "No description available"}
              </CardDescription>
            </div>
            {company.logo_url && (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {company.industry && (
              <Badge variant="secondary">
                <Building2 className="mr-1 h-3 w-3" />
                {company.industry}
              </Badge>
            )}
            {company.location && (
              <Badge variant="outline">
                <MapPin className="mr-1 h-3 w-3" />
                {company.location}
              </Badge>
            )}
            {company.employee_count && (
              <Badge variant="outline">
                <Users className="mr-1 h-3 w-3" />
                {company.employee_count}
              </Badge>
            )}
          </div>

          {company.technologies && company.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {company.technologies.slice(0, 5).map((tech) => (
                <Badge key={tech} variant="secondary" className="text-xs">
                  {tech}
                </Badge>
              ))}
              {company.technologies.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{company.technologies.length - 5}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                Quality: {company.data_quality_score}%
              </div>
            </div>
            <div className="flex gap-2">
              {company.website && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={company.website} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="default" size="sm" onClick={() => setResearchModalOpen(true)}>
                Get more info
              </Button>
            </div>
          </div>

          {showAddToList && (
            <div className="pt-2 border-t">
              <AddToListButton companyId={company.id} companyName={company.name} />
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyResearchModal
        companyId={company.id}
        companyName={company.name}
        open={researchModalOpen}
        onOpenChange={setResearchModalOpen}
      />
    </>
  )
}
