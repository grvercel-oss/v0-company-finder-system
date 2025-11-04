import type React from "react"
import { Navigation } from "@/components/navigation"
import { ReplyNotification } from "@/components/reply-notification"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navigation />
      <ReplyNotification />
      {children}
    </>
  )
}
