"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Users, Mail, MessageSquare, Trash2 } from "lucide-react"
import Link from "next/link"
import { CampaignContactsTable } from "@/components/campaign-contacts-table"
import { useToast } from "@/hooks/use-toast"

interface Campaign {
  id: number
  name: string
  description: string
  status: string
  created_at: string
}

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

interface CampaignDetailProps {
  campaignId: string
}

export function CampaignDetail({ campaignId }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContacts, setSelectedContacts] = useState<number[]>([])
  const { toast } = useToast()

  useEffect(() => {
    fetchCampaign()
  }, [campaignId])

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`)
      const data = await response.json()
      setCampaign(data.campaign)
      setContacts(data.contacts || [])
    } catch (error) {
      console.error("Failed to fetch campaign:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveContacts = async () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select contacts to remove",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`Remove ${selectedContacts.length} contact(s) from this campaign?`)) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/contacts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: selectedContacts }),
      })

      if (!response.ok) throw new Error("Failed to remove contacts")

      toast({
        title: "Contacts removed",
        description: `${selectedContacts.length} contact(s) removed from campaign`,
      })

      setSelectedContacts([])
      fetchCampaign()
    } catch (error) {
      console.error("Error removing contacts:", error)
      toast({
        title: "Error",
        description: "Failed to remove contacts from campaign",
        variant: "destructive",
      })
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
    pending: contacts.length,
    sent: 0,
    replied: 0,
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

      <Tabs defaultValue="contacts" className="w-full">
        <TabsList>
          <TabsTrigger value="contacts">
            <Users className="h-4 w-4 mr-2" />
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="emails" disabled>
            <Mail className="h-4 w-4 mr-2" />
            Emails (Coming Soon)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4">
          {selectedContacts.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{selectedContacts.length} contact(s) selected</p>
                  <Button variant="destructive" size="sm" onClick={handleRemoveContacts}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove from Campaign
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <CampaignContactsTable
            contacts={contacts}
            selectedContacts={selectedContacts}
            onSelectionChange={setSelectedContacts}
          />
        </TabsContent>

        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle>Email Campaign</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Email generation and sending functionality coming soon. For now, use Hunter.io to find and add contacts
                to your campaign.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
