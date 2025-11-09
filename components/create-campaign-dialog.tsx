"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Mail, Target, Users, TrendingUp, Zap, Rocket, Megaphone, Send } from "lucide-react"

interface CreateCampaignDialogProps {
  onSuccess?: () => void
}

const ICON_OPTIONS = [
  { name: "mail", Icon: Mail },
  { name: "target", Icon: Target },
  { name: "users", Icon: Users },
  { name: "trending", Icon: TrendingUp },
  { name: "zap", Icon: Zap },
  { name: "rocket", Icon: Rocket },
  { name: "megaphone", Icon: Megaphone },
  { name: "send", Icon: Send },
]

const COLOR_OPTIONS = [
  { name: "gray", textClass: "text-gray-600", bgClass: "bg-gray-600" },
  { name: "blue", textClass: "text-blue-600", bgClass: "bg-blue-600" },
  { name: "green", textClass: "text-green-600", bgClass: "bg-green-600" },
  { name: "purple", textClass: "text-purple-600", bgClass: "bg-purple-600" },
  { name: "orange", textClass: "text-orange-600", bgClass: "bg-orange-600" },
  { name: "pink", textClass: "text-pink-600", bgClass: "bg-pink-600" },
  { name: "red", textClass: "text-red-600", bgClass: "bg-red-600" },
  { name: "accent", textClass: "text-accent", bgClass: "bg-accent" },
]

export function CreateCampaignDialog({ onSuccess }: CreateCampaignDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [emailPrompt, setEmailPrompt] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("mail")
  const [selectedColor, setSelectedColor] = useState("blue")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          email_prompt: emailPrompt,
          icon: selectedIcon,
          color: selectedColor,
        }),
      })

      if (!response.ok) throw new Error("Failed to create campaign")

      const data = await response.json()
      setOpen(false)
      setName("")
      setDescription("")
      setEmailPrompt("")
      setSelectedIcon("mail")
      setSelectedColor("blue")

      if (onSuccess) {
        onSuccess()
      }

      router.push(`/campaigns/${data.campaign.id}`)
    } catch (error) {
      console.error("Failed to create campaign:", error)
      alert("Failed to create campaign. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Create a new outreach campaign. You'll be able to add contacts and send emails after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2025 Outreach"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this campaign about?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailPrompt">Email Instructions</Label>
            <Textarea
              id="emailPrompt"
              value={emailPrompt}
              onChange={(e) => setEmailPrompt(e.target.value)}
              placeholder="e.g., Focus on our new product launch, mention cost savings, use a friendly tone..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Provide guidance for AI email generation - what should the emails be about, key points to mention, tone,
              etc.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedIcon(name)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    selectedIcon === name ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(({ name, bgClass }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedColor(name)}
                  className={`w-12 h-12 rounded-lg border-2 transition-colors ${
                    selectedColor === name
                      ? "border-accent ring-2 ring-accent/30"
                      : "border-border hover:border-accent/50"
                  }`}
                >
                  <div className={`w-full h-full rounded-md ${bgClass}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name}>
              {loading ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
