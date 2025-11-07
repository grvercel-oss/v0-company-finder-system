"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Mail, Briefcase, Linkedin, ExternalLink } from "lucide-react"

interface Contact {
  id: number
  name: string
  email: string
  job_title: string
  company_name: string
  company_description: string
  company_website?: string
  company_industry?: string
  company_size?: string
  linkedin_url?: string
  source?: string
  hunter_confidence?: number
  email_verification_status?: string
  added_at: string
}

interface CampaignContactsTableProps {
  contacts: Contact[]
}

export function CampaignContactsTable({ contacts }: CampaignContactsTableProps) {
  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No contacts yet</h3>
          <p className="text-muted-foreground text-center">
            Add contacts to this campaign using Hunter.io Executive Finder
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {contacts.map((contact) => (
        <Card key={contact.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {contact.name}
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                </CardTitle>
                {contact.job_title && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    {contact.job_title}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {contact.source && (
                  <Badge variant="secondary" className="text-xs">
                    {contact.source}
                  </Badge>
                )}
                {contact.email_verification_status && (
                  <Badge
                    variant={contact.email_verification_status === "valid" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {contact.email_verification_status}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                {contact.email}
              </a>
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.company_name}</span>
                    {contact.company_website && (
                      <a
                        href={
                          contact.company_website.startsWith("http")
                            ? contact.company_website
                            : `https://${contact.company_website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {contact.company_description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{contact.company_description}</p>
                  )}
                  {(contact.company_industry || contact.company_size) && (
                    <div className="flex gap-2 mt-1">
                      {contact.company_industry && (
                        <Badge variant="outline" className="text-xs">
                          {contact.company_industry}
                        </Badge>
                      )}
                      {contact.company_size && (
                        <Badge variant="outline" className="text-xs">
                          {contact.company_size}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-2">
              Added {new Date(contact.added_at).toLocaleDateString()}
              {contact.hunter_confidence && ` • ${contact.hunter_confidence}% confidence`}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
