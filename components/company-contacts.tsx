"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, Linkedin, Copy, CheckCircle2 } from "lucide-react"
import { useState } from "react"

interface Contact {
  id: number
  name: string
  role: string
  email: string
  phone?: string
  linkedin_url?: string
  source?: string
  confidence_score: number
  verified: boolean
}

interface CompanyContactsProps {
  contacts: Contact[]
}

export function CompanyContacts({ contacts }: CompanyContactsProps) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email)
    setCopiedEmail(email)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  if (!contacts || contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Key Contacts</CardTitle>
          <CardDescription>Decision-makers and key personnel</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No contacts found for this company yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Key Contacts</CardTitle>
        <CardDescription>Decision-makers and key personnel at this company</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{contact.name}</h4>
                  {contact.verified && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                  {contact.confidence_score >= 0.9 && (
                    <Badge variant="outline" className="text-xs">
                      High Confidence
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{contact.role}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{contact.email}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyEmail(contact.email)}>
                    {copiedEmail === contact.email ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {contact.linkedin_url && (
                  <Button variant="outline" size="sm" className="h-8 bg-transparent" asChild>
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="h-4 w-4 mr-2" />
                      View LinkedIn
                    </a>
                  </Button>
                )}
                {contact.source && <p className="text-xs text-muted-foreground">Source: {contact.source}</p>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
