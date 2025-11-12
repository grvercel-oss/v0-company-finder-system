import type React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ReplyNotification } from "@/components/reply-notification"
import { AICostTrackerOverlay } from "@/components/ai-cost-tracker-overlay"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <ReplyNotification />
        {children}
      </main>
      <AICostTrackerOverlay />
    </div>
  )
}
