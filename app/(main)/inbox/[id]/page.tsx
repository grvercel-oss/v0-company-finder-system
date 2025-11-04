"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft, Send, Mail, User } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface Message {
  id: number
  direction: "sent" | "received"
  from_email: string
  from_name: string
  to_email: string
  subject: string
  body: string
  html_body: string
  sent_at: string
  received_at: string
  is_read: boolean
  is_ai_generated: boolean
  created_at: string
}

interface Thread {
  id: number
  subject: string
  contact_email: string
  first_name: string
  last_name: string
  company_name: string
  job_title: string
  campaign_name: string
  campaign_description: string
  status: string
  message_count: number
  reply_count: number
}

export default function ThreadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const threadId = params.id as string

  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchThread()
  }, [threadId])

  const fetchThread = async () => {
    try {
      console.log("[v0] Fetching thread:", threadId)
      const response = await fetch(`/api/emails/threads/${threadId}`)

      if (!response.ok) {
        console.error("[v0] Failed to fetch thread:", response.status, response.statusText)
        return
      }

      const data = await response.json()
      console.log("[v0] Thread data received:", data)
      console.log("[v0] Messages count:", data.messages?.length || 0)

      setThread(data.thread)
      setMessages(data.messages || [])
    } catch (error) {
      console.error("[v0] Failed to fetch thread:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !thread) return

    setSending(true)
    try {
      const response = await fetch("/api/emails/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          contactEmail: thread.contact_email,
          subject: `Re: ${thread.subject}`,
          body: replyText,
        }),
      })

      if (response.ok) {
        setReplyText("")
        fetchThread() // Refresh messages
      } else {
        alert("Failed to send reply")
      }
    } catch (error) {
      console.error("Failed to send reply:", error)
      alert("Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">Thread not found</h3>
          <p className="text-muted-foreground mb-4">This conversation may have been deleted</p>
          <Button asChild>
            <Link href="/inbox">Back to Inbox</Link>
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/inbox">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{thread.subject}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <span>
              {thread.first_name} {thread.last_name}
            </span>
            <span>•</span>
            <span>{thread.contact_email}</span>
            <span>•</span>
            <span>{thread.company_name}</span>
          </div>
        </div>
        <Badge variant="outline">{thread.campaign_name}</Badge>
      </div>

      {/* Messages */}
      <div className="space-y-4 mb-6">
        {messages.length === 0 ? (
          <Card className="p-8 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-muted-foreground">Messages will appear here once they are sent or received</p>
          </Card>
        ) : (
          messages.map((message) => {
            const messageTime = message.sent_at || message.received_at || message.created_at
            const isSent = message.direction === "sent"

            return (
              <Card key={message.id} className={`p-4 ${isSent ? "bg-primary/5 border-primary/20" : "bg-muted/50"}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 ${isSent ? "text-primary" : "text-muted-foreground"}`}>
                    {isSent ? <Send className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{message.from_name || message.from_email}</span>
                        {message.is_ai_generated && (
                          <Badge variant="secondary" className="text-xs">
                            AI Generated
                          </Badge>
                        )}
                        {isSent && (
                          <Badge variant="outline" className="text-xs">
                            Sent
                          </Badge>
                        )}
                        {!isSent && (
                          <Badge variant="default" className="text-xs">
                            Reply
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(messageTime), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      From: {message.from_email} → To: {message.to_email}
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {message.html_body ? (
                        <div dangerouslySetInnerHTML={{ __html: message.html_body }} />
                      ) : (
                        <p className="whitespace-pre-wrap">{message.body}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Reply Box */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Send Reply</h3>
        <Textarea
          placeholder="Type your reply..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={4}
          className="mb-3"
        />
        <div className="flex justify-end">
          <Button onClick={handleSendReply} disabled={sending || !replyText.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Reply
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
