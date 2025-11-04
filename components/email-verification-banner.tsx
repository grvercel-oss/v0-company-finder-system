"use client"

import { useState } from "react"
import { useAuth } from "./auth-provider"
import { Button } from "./ui/button"
import { Alert, AlertDescription } from "./ui/alert"
import { Mail, X } from "lucide-react"

export function EmailVerificationBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState("")

  if (!user || user.emailVerified || dismissed) {
    return null
  }

  const handleResend = async () => {
    setSending(true)
    setMessage("")

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      })

      const data = await res.json()

      if (data.success) {
        setMessage("Verification email sent! Check your console/email.")
      } else {
        setMessage(data.error || "Failed to send email")
      }
    } catch (error) {
      setMessage("Failed to send verification email")
    } finally {
      setSending(false)
    }
  }

  return (
    <Alert className="relative border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <Mail className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-yellow-800 dark:text-yellow-200">Please verify your email address</p>
          {message && <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">{message}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleResend}
            disabled={sending}
            className="border-yellow-600 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-200 bg-transparent"
          >
            {sending ? "Sending..." : "Resend Email"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
