"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, Loader2, RefreshCw } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import Image from "next/image"

interface Contact {
  id: number
  email: string
  first_name: string
  last_name: string
  company_name: string
  subject: string
  body: string
  status: string
}

interface EmailSenderProps {
  campaignId: string
  contacts: Contact[]
  failedContacts?: Contact[]
  onComplete: () => void
}

interface ConnectionStatus {
  connected: boolean
  provider: string | null
  email: string | null
}

const providerLogos: Record<string, string> = {
  outlook:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Microsoft_Outlook_logo_%282024%E2%80%932025%29.svg-hbnw6z6H0Yggj28pJb1t6MlxveHi03.png",
  gmail:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gmail_icon_%282020%29.svg-7fzrXzltYTUg2fR1s7lUQzJb6LZuJz.png",
  zoho: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/zoho-logo-512-MURDH2sv880dMkNvUcynJMNLhOtl5F.png",
}

const providerNames: Record<string, string> = {
  outlook: "Microsoft Outlook",
  gmail: "Gmail",
  zoho: "Zoho Mail",
}

export function EmailSender({ campaignId, contacts, failedContacts = [], onComplete }: EmailSenderProps) {
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  useEffect(() => {
    fetchConnectionStatus()
  }, [])

  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch("/api/email/connection-status")
      const data = await response.json()
      setConnectionStatus(data)
    } catch (error) {
      console.error("Failed to fetch connection status:", error)
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleSend = async (contactsToSend: Contact[]) => {
    console.log("[v0] [CLIENT] handleSend called with", contactsToSend.length, "contacts")

    if (contactsToSend.length === 0) {
      console.log("[v0] [CLIENT] No contacts to send")
      return
    }

    if (!connectionStatus?.connected) {
      console.log("[v0] [CLIENT] No email service connected")
      alert("Please connect an email service in Settings before sending emails.")
      return
    }

    console.log("[v0] [CLIENT] Starting email send process with provider:", connectionStatus.provider)
    setSending(true)
    setProgress(0)

    try {
      const contactIds = contactsToSend.map((c) => c.id)
      console.log("[v0] [CLIENT] Contact IDs to send:", contactIds)
      const batchSize = 10 // Send 10 at a time

      let totalSuccesses = 0
      let totalFailures = 0
      const failedContacts: Array<{ contactId: number; error: string }> = []

      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batch = contactIds.slice(i, i + batchSize)
        console.log("[v0] [CLIENT] Sending batch:", batch)

        const response = await fetch("/api/emails/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: batch }),
        })

        console.log("[v0] [CLIENT] Response status:", response.status)

        const result = await response.json()

        if (result.results) {
          for (const r of result.results) {
            if (r.success) {
              totalSuccesses++
            } else {
              totalFailures++
              failedContacts.push({ contactId: r.contactId, error: r.error })
            }
          }
        }

        if (response.status === 500) {
          throw new Error(result.error || "Failed to send emails")
        }

        setProgress(Math.round(((i + batch.length) / contactIds.length) * 100))

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      if (totalFailures > 0) {
        alert(
          `Sent ${totalSuccesses} emails successfully.\n${totalFailures} emails failed.\n\nPlease check the failed contacts and retry.`,
        )
      } else {
        alert(`Successfully sent ${totalSuccesses} emails!`)
      }

      onComplete()
    } catch (error) {
      console.error("[v0] [CLIENT] Sending error:", error)
      alert(
        error instanceof Error
          ? error.message
          : "Failed to send emails. Please check your email configuration and try again.",
      )
    } finally {
      setSending(false)
      setProgress(0)
    }
  }

  const handleRetryFailed = async () => {
    if (failedContacts.length === 0) return

    if (!confirm(`Retry sending ${failedContacts.length} failed emails?`)) return

    setSending(true)
    setProgress(0)

    try {
      // Reset failed contacts to 'generated' status
      const contactIds = failedContacts.map((c) => c.id)

      const resetResponse = await fetch("/api/emails/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
      })

      if (!resetResponse.ok) {
        throw new Error("Failed to reset contact status")
      }

      // Now send them
      await handleSend(failedContacts)
    } catch (error) {
      console.error("Retry error:", error)
      alert(error instanceof Error ? error.message : "Failed to retry emails")
      setSending(false)
      setProgress(0)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Emails</CardTitle>
        <CardDescription>
          {connectionStatus?.connected
            ? `Send your generated emails via ${providerNames[connectionStatus.provider || ""] || "email service"}`
            : "Connect an email service to send emails"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-4">
            <div>
              <div className="font-medium">{contacts.length} emails ready to send</div>
              {loadingStatus ? (
                <div className="text-sm text-muted-foreground">Loading service status...</div>
              ) : connectionStatus?.connected && connectionStatus.provider ? (
                <div className="flex items-center gap-2 mt-2">
                  <div className="relative h-5 w-5">
                    <Image
                      src={providerLogos[connectionStatus.provider] || "/placeholder.svg"}
                      alt={providerNames[connectionStatus.provider]}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Sending via {providerNames[connectionStatus.provider]}
                  </span>
                </div>
              ) : (
                <div className="text-sm text-destructive mt-2">No email service connected</div>
              )}
            </div>
          </div>
          <Button
            onClick={() => handleSend(contacts)}
            disabled={sending || contacts.length === 0 || !connectionStatus?.connected}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send All
              </>
            )}
          </Button>
        </div>

        {failedContacts.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div>
              <div className="font-medium text-destructive">{failedContacts.length} emails failed</div>
              <div className="text-sm text-muted-foreground">Click retry to attempt sending these emails again</div>
            </div>
            <Button onClick={handleRetryFailed} disabled={sending} variant="destructive">
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Failed
                </>
              )}
            </Button>
          </div>
        )}

        {sending && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sending emails...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p>Before sending, make sure:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Your email service is connected in Settings</li>
            <li>You've reviewed the generated emails</li>
            <li>Your email account has sufficient sending limits</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
