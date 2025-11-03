"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { X, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"

interface Reply {
  id: number
  thread_id: string
  from_email: string
  from_name: string
  subject: string
  received_at: string
  contact_id: number
}

export function ReplyNotification() {
  const [notifications, setNotifications] = useState<Reply[]>([])
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      // Check for account_id cookie
      const cookies = document.cookie.split(";")
      const accountIdCookie = cookies.find((c) => c.trim().startsWith("account_id="))
      return !!accountIdCookie
    }

    // Check for new replies every 30 seconds
    const checkForReplies = async () => {
      if (!checkAuth()) {
        return
      }

      try {
        const response = await fetch("/api/notifications/replies")

        if (response.status === 401) {
          return
        }

        if (response.ok) {
          const data = await response.json()
          setNotifications(data.replies || [])
        }
      } catch (error) {
        // Only log if it's not a network/auth error
        if (error instanceof Error && !error.message.includes("Load failed")) {
          console.error("Failed to fetch notifications:", error)
        }
      }
    }

    checkForReplies()
    const interval = setInterval(checkForReplies, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const handleNotificationClick = async (reply: Reply) => {
    // Mark notification as clicked
    try {
      await fetch(`/api/notifications/replies/${reply.id}/click`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed to mark notification as clicked:", error)
    }

    // Remove from UI
    setNotifications((prev) => prev.filter((n) => n.id !== reply.id))

    // Navigate to thread
    router.push(`/inbox/${reply.thread_id}`)
  }

  const handleDismiss = async (replyId: number, e: React.MouseEvent) => {
    e.stopPropagation()

    // Mark as shown (dismissed)
    try {
      await fetch(`/api/notifications/replies/${replyId}/dismiss`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed to dismiss notification:", error)
    }

    // Remove from UI
    setNotifications((prev) => prev.filter((n) => n.id !== replyId))
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((reply) => (
        <div
          key={reply.id}
          onClick={() => handleNotificationClick(reply)}
          className="bg-background border border-border rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-xl transition-all duration-200 animate-in slide-in-from-top-2"
          style={{
            backdropFilter: "blur(20px)",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Mail className="h-5 w-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-foreground truncate">New Reply</p>
                <button
                  onClick={(e) => handleDismiss(reply.id, e)}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-foreground font-medium truncate mb-1">{reply.from_name || reply.from_email}</p>

              <p className="text-xs text-muted-foreground truncate mb-2">{reply.subject}</p>

              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(reply.received_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
