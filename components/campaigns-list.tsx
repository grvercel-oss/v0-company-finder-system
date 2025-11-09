"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Mail, Users, MessageSquare, Trash2, Target, TrendingUp, Zap, Rocket, Megaphone, Send } from "lucide-react"
import { CreateCampaignDialog } from "@/components/create-campaign-dialog"

interface Campaign {
  id: number
  name: string
  description: string
  status: string
  icon?: string
  color?: string
  total_contacts: number
  emails_sent: number
  replies_received: number
  created_at: string
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  target: Target,
  users: Users,
  trending: TrendingUp,
  zap: Zap,
  rocket: Rocket,
  megaphone: Megaphone,
  send: Send,
}

const COLOR_MAP: Record<string, string> = {
  gray: "text-gray-600",
  blue: "text-blue-600",
  green: "text-green-600",
  purple: "text-purple-600",
  orange: "text-orange-600",
  pink: "text-pink-600",
  red: "text-red-600",
  accent: "text-accent",
}

export function CampaignsList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns")
      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error("Failed to fetch campaigns:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, campaign: Campaign) => {
    e.preventDefault()
    e.stopPropagation()
    setCampaignToDelete(campaign)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setCampaigns(campaigns.filter((c) => c.id !== campaignToDelete.id))
        setDeleteDialogOpen(false)
        setCampaignToDelete(null)
      } else {
        alert("Failed to delete campaign")
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error)
      alert("Failed to delete campaign")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading campaigns...</div>
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Your Campaigns</h2>
          <CreateCampaignDialog onSuccess={fetchCampaigns} />
        </div>

        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4 text-center">
                Create your first campaign to start reaching out to potential customers
              </p>
              <CreateCampaignDialog onSuccess={fetchCampaigns} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => {
              const IconComponent = ICON_MAP[campaign.icon || "mail"] || Mail
              const colorClass = COLOR_MAP[campaign.color || "blue"] || "text-blue-600"

              return (
                <div key={campaign.id} className="relative group">
                  <Link href={`/campaigns/${campaign.id}`}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <IconComponent className={`h-5 w-5 ${colorClass}`} />
                            <CardTitle className="text-lg">{campaign.name}</CardTitle>
                          </div>
                          <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                            {campaign.status}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {campaign.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>Contacts</span>
                            </div>
                            <span className="font-semibold">{campaign.total_contacts || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              <span>Sent</span>
                            </div>
                            <span className="font-semibold">{campaign.emails_sent || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MessageSquare className="h-4 w-4" />
                              <span>Replies</span>
                            </div>
                            <span className="font-semibold">{campaign.replies_received || 0}</span>
                          </div>
                          <div className="text-xs text-muted-foreground pt-2 border-t">
                            Created {new Date(campaign.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteClick(e, campaign)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{campaignToDelete?.name}"? This will also delete all associated contacts
              and emails. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
