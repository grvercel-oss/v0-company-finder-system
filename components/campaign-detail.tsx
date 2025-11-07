"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Users, Mail, MessageSquare } from "lucide-react"
import Link from "next/link"
import { ContactsManager } from "@/components/contacts-manager"

interface Campaign {
  id: number
  name: string
  description: string
  status: string
  created_at: string
}

interface Contact {
  id: number
  email: string
  first_name: string
  last_name: string
  company_name: string
  job_title: string
  status: string
  subject: string
  body: string
  sent_at: string
  created_at: string
}

interface CampaignDetailProps {
  campaignId: string
}

export function CampaignDetail({ campaignId }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaign()
  }, [campaignId])

  const fetchCampaign = async () => {
    try {
      console.log("[v0] Fetching campaign:", campaignId)
      const response = await fetch(`/api/campaigns/${campaignId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch campaign: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("[v0] Campaign data:", data)

      setCampaign(data.campaign)
      setContacts(data.contacts || [])
    } catch (error) {
      console.error("Error fetching campaign:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading campaign...</div>
  }

  if (!campaign) {
    return <div className="text-center py-12">Campaign not found</div>
  }

  const stats = {
    total: contacts.length,
    pending: contacts.filter((c) => c.status === "pending").length,
    sent: contacts.filter((c) => c.status === "sent").length,
    replied: 0, // TODO: Track replies
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">{campaign.description || "No description"}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Replies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.replied}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      <ContactsManager campaignId={campaignId} contacts={contacts} onUpdate={fetchCampaign} />
    </div>
  )
}
