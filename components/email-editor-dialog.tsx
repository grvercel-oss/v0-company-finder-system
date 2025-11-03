"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Loader2, RefreshCw, Save } from "lucide-react"

interface Contact {
  id: number
  email: string
  first_name: string
  last_name: string
  subject: string
  body: string
  original_subject?: string
  original_body?: string
}

interface EmailEditorDialogProps {
  contact: Contact
  onUpdate: () => void
}

export function EmailEditorDialog({ contact, onUpdate }: EmailEditorDialogProps) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState(contact.subject)
  const [body, setBody] = useState(contact.body)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      })

      if (!response.ok) throw new Error("Failed to save")

      onUpdate()
      setOpen(false)
    } catch (error) {
      console.error("Save error:", error)
      alert("Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (!confirm("Regenerate this email? Current content will be replaced.")) return

    setRegenerating(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}/regenerate`, {
        method: "POST",
      })

      if (!response.ok) throw new Error("Failed to regenerate")

      const data = await response.json()
      setSubject(data.contact.subject)
      setBody(data.contact.body)
      onUpdate()
    } catch (error) {
      console.error("Regenerate error:", error)
      alert("Failed to regenerate email")
    } finally {
      setRegenerating(false)
    }
  }

  const handleRestore = () => {
    if (contact.original_subject && contact.original_body) {
      setSubject(contact.original_subject)
      setBody(contact.original_body)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Email</DialogTitle>
          <DialogDescription>
            Edit the email content for {contact.first_name} {contact.last_name} ({contact.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              {contact.original_subject && contact.original_body && (
                <Button variant="outline" size="sm" onClick={handleRestore}>
                  Restore Original
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
                {regenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate with AI
                  </>
                )}
              </Button>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
