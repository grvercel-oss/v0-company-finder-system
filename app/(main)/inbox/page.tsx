"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RefreshCw, Loader2, Mail, MailOpen, ArrowLeft, AlertCircle, Trash2 } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

interface Thread {
  id: number
  subject: string
  contact_email: string
  first_name: string
  last_name: string
  company_name: string
  campaign_name: string
  status: string
  has_unread_replies: boolean
  last_message_at: string
  reply_count: number
  message_count: number
  unread_count: number
}

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [scopeError, setScopeError] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [threadToDelete, setThreadToDelete] = useState<Thread | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchThreads()
  }, [])

  const fetchThreads = async () => {
    try {
      console.log("[v0] [INBOX] Fetching threads from API...")
      const response = await fetch("/api/emails/threads")
      console.log("[v0] [INBOX] API response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] [INBOX] Received threads:", data.threads?.length || 0)
        setThreads(data.threads)
      } else {
        console.error("[v0] [INBOX] Failed to fetch threads:", response.status, response.statusText)
      }
    } catch (error) {
      console.error("[v0] [INBOX] Failed to fetch threads:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckReplies = async () => {
    setChecking(true)
    setScopeError(false)
    try {
      const response = await fetch("/api/emails/check-replies", { method: "POST" })

      if (response.status === 401) {
        const data = await response.json()
        if (data.needsReconnect || data.error === "INVALID_OAUTHSCOPE") {
          setScopeError(true)
          return
        }
      }

      if (response.ok) {
        const data = await response.json()
        alert(`Checked ${data.checked} emails. Found ${data.repliesFound} new replies!`)
        fetchThreads()
      } else {
        const data = await response.json()
        alert(`Failed to check for replies: ${data.message || data.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Failed to check replies:", error)
      alert("Failed to check for replies")
    } finally {
      setChecking(false)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, thread: Thread) => {
    e.preventDefault()
    e.stopPropagation()
    setThreadToDelete(thread)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!threadToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/emails/threads/${threadToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setThreads(threads.filter((t) => t.id !== threadToDelete.id))
        setDeleteDialogOpen(false)
        setThreadToDelete(null)
      } else {
        alert("Failed to delete conversation")
      }
    } catch (error) {
      console.error("Failed to delete thread:", error)
      alert("Failed to delete conversation")
    } finally {
      setDeleting(false)
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

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/campaigns">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Inbox</h1>
              <p className="text-muted-foreground">Manage email conversations and replies</p>
            </div>
          </div>
          <Button onClick={handleCheckReplies} disabled={checking}>
            {checking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check for Replies
              </>
            )}
          </Button>
        </div>

        {scopeError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Reconnection Required</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Your Zoho account was connected before inbox features were added. To read emails and check for replies,
                you need to reconnect your account to grant the additional permissions.
              </p>
              <div className="bg-destructive/10 p-3 rounded-md text-sm">
                <p className="font-semibold mb-1">How to reconnect:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to Settings → Email Connection tab</li>
                  <li>Click "Disconnect" to remove the old connection</li>
                  <li>Click "Connect with Zoho" to reconnect with new permissions</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/settings?tab=email">Go to Settings</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {threads.length === 0 ? (
          <Card className="p-12 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
            <p className="text-muted-foreground mb-4">
              Send some emails from your campaigns and check back here for replies
            </p>
            <Button onClick={handleCheckReplies} disabled={checking}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Replies
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <div key={thread.id} className="relative group">
                <Link href={`/inbox/${thread.id}`}>
                  <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-1">
                          {thread.unread_count > 0 ? (
                            <Mail className="h-5 w-5 text-primary" />
                          ) : (
                            <MailOpen className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">
                              {thread.first_name} {thread.last_name}
                            </h3>
                            {thread.unread_count > 0 && (
                              <Badge variant="default" className="text-xs">
                                {thread.unread_count} new
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {thread.contact_email} • {thread.company_name}
                          </p>
                          <p className="text-sm font-medium truncate mb-1">{thread.subject}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {thread.campaign_name}
                            </Badge>
                            <span>•</span>
                            <span>{thread.message_count} messages</span>
                            <span>•</span>
                            <span>{thread.reply_count} replies</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                      </div>
                    </div>
                  </Card>
                </Link>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => handleDeleteClick(e, thread)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation with {threadToDelete?.first_name}{" "}
              {threadToDelete?.last_name}? This will delete all messages in this thread. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
