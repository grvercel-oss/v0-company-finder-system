import { CampaignsList } from "@/components/campaigns-list"

export default function CampaignsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Outreach Campaigns</h1>
        <p className="text-muted-foreground">Create and manage your AI-powered email outreach campaigns</p>
      </div>

      <CampaignsList />
    </div>
  )
}
