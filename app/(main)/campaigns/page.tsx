"use client"

import { CampaignsList } from "@/components/campaigns-list"

export default function CampaignsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold">Campaigns</h1>
        <p className="text-muted-foreground">Manage your email campaigns and track performance</p>
      </div>
      <CampaignsList />
    </div>
  )
}
