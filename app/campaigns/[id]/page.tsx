"use client"

import { CampaignDetail } from "@/components/campaign-detail"
import { useParams } from "next/navigation"

export default function CampaignPage() {
  const params = useParams()
  const id = params?.id as string

  return (
    <div className="container mx-auto py-8 px-4">
      <CampaignDetail campaignId={id} />
    </div>
  )
}
