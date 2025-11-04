import type React from "react"
import { Navigation } from "@/components/navigation"
import { ReplyNotification } from "@/components/reply-notification"
import { EmailVerificationBanner } from "@/components/email-verification-banner"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navigation />
      <EmailVerificationBanner />
      <ReplyNotification />
      {children}
    </>
  )
}
