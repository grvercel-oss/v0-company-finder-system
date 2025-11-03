"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Send, Loader2, Sparkles, User, Bot } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { useParams } from "next/navigation"

interface Message {
  id: number
  direction: "sent" | "received"
  from_email: string
  from_name: string
  to_email: string
  subject: string
  body: string
  html_body: string
  is_ai_generated: boolean
  ai_prompt: string | null
  sent_at: string | null
  received_at: string | null
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
}

export default function ThreadPage() {
  const params = useParams()
  const threadId = params?.id as string
  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (threadId) {
      fetchThread()
    }
  }, [threadId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchThread = async () => {
    try {
      console.log("[v0] [CLIENT] Fetching thread with ID:", threadId)
      const response = await fetch(`/api/emails/threads/${threadId}`)
      console.log("[v0] [CLIENT] Thread fetch response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] [CLIENT] Thread data received:", data)
        setThread(data.thread)
        setMessages(data.messages)
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[v0] [CLIENT] Failed to fetch thread:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          threadId,
        })
      }
    } catch (error) {
      console.error("[v0] [CLIENT] Failed to fetch thread:", error)
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
          isAiGenerated: false,
        }),
      })

      if (response.ok) {
        setReplyText("")
        fetchThread()
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

  const handleGenerateReply = async () => {
    if (!aiPrompt.trim() || !thread) return

    setGenerating(true)
    try {
      const response = await fetch("/api/emails/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          prompt: aiPrompt,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setReplyText(data.reply)
        setShowAiPrompt(false)
        setAiPrompt("")
      } else {
        alert("Failed to generate reply")
      }
    } catch (error) {
      console.error("Failed to generate reply:", error)
      alert("Failed to generate reply")
    } finally {
      setGenerating(false)
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
          <Link href="/inbox">
            <Button>Back to Inbox</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/inbox">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {thread.first_name} {thread.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {thread.contact_email} • {thread.company_name}
            {thread.job_title && ` • ${thread.job_title}`}
          </p>
        </div>
        <Badge variant="outline">{thread.campaign_name}</Badge>
      </div>

      <Card className="mb-4 p-4 bg-muted/50">
        <p className="text-sm font-medium mb-1">Subject</p>
        <p className="text-sm text-muted-foreground">{thread.subject}</p>
      </Card>

      <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.direction === "sent" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div className="flex-shrink-0">
              {message.direction === "sent" ? (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className={`flex-1 max-w-[80%] ${message.direction === "sent" ? "items-end" : "items-start"}`}>
              <Card className={`p-4 ${message.direction === "sent" ? "bg-primary text-primary-foreground" : ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium">{message.from_name || message.from_email}</p>
                  {message.is_ai_generated && (
                    <Badge variant="secondary" className="text-xs">
                      <Bot className="h-3 w-3 mr-1" />
                      AI
                    </Badge>
                  )}
                </div>
                <div
                  className="text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: message.html_body || message.body }}
                />
                <p className="text-xs opacity-70 mt-2">
                  {formatDistanceToNow(new Date(message.sent_at || message.received_at || ""), { addSuffix: true })}
                </p>
              </Card>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <Card className="p-4">
        {showAiPrompt ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">AI Reply Generator</p>
            </div>
            <Textarea
              placeholder="Tell AI what you want to say... (e.g., 'Accept the meeting and suggest next Tuesday at 2pm')"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={handleGenerateReply} disabled={generating || !aiPrompt.trim()} className="flex-1">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Reply
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowAiPrompt(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button onClick={handleSendReply} disabled={sending || !replyText.trim()} className="flex-1">
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
              <Button variant="outline" onClick={() => setShowAiPrompt(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Generate
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
