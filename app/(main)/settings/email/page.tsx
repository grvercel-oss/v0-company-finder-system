"use client"

import { Suspense } from "react"
import { EmailSettingsContent } from "@/components/email-settings-content"
import { Loader2 } from "lucide-react"

function EmailSettingsLoading() {
  return (
    <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
}

export default function EmailSettingsPage() {
  return (
    <Suspense fallback={<EmailSettingsLoading />}>
      <EmailSettingsContent />
    </Suspense>
  )
}
