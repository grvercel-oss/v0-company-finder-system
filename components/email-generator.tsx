"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface Contact {
  id: number
  email: string
  first_name: string
  last_name: string
  company_name: string
  status: string
}

interface EmailGeneratorProps {
  campaignId: string
  contacts: Contact[]
  campaign: {
    name: string
    description?: string
    email_prompt?: string
  }
  onComplete: () => void
}

export function EmailGenerator({ campaignId, contacts, campaign, onComplete }: EmailGeneratorProps) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [emailPrompt, setEmailPrompt] = useState(campaign.email_prompt || "")
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)

  const handleSavePrompt = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_prompt: emailPrompt }),
      })

      if (!response.ok) throw new Error("Failed to update campaign")

      setIsEditingPrompt(false)
      alert("Email instructions updated successfully!")
    } catch (error) {
      console.error("Failed to update prompt:", error)
      alert("Failed to update email instructions")
    }
  }

  const handleGenerate = async () => {
    if (contacts.length === 0) return

    setGenerating(true)
    setProgress(0)

    try {
      const contactIds = contacts.map((c) => c.id)
      const batchSize = 5

      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batch = contactIds.slice(i, i + batchSize)

        const response = await fetch("/api/emails/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, contactIds: batch, email_prompt: emailPrompt }),
        })

        if (!response.ok) throw new Error("Failed to generate emails")

        setProgress(Math.round(((i + batch.length) / contactIds.length) * 100))
      }

      alert(`Successfully generated ${contactIds.length} emails!`)
      onComplete()
    } catch (error) {
      console.error("Generation error:", error)
      alert("Failed to generate emails. Please check your OpenAI API key and try again.")
    } finally {
      setGenerating(false)
      setProgress(0)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate AI Emails</CardTitle>
        <CardDescription>Use AI to generate personalized emails for your contacts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Email Instructions</Label>
            {!isEditingPrompt && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditingPrompt(true)}>
                Edit
              </Button>
            )}
          </div>
          {isEditingPrompt ? (
            <div className="space-y-3">
              <Textarea
                value={emailPrompt}
                onChange={(e) => setEmailPrompt(e.target.value)}
                placeholder="e.g., Focus on our new product launch, mention cost savings, use a friendly tone..."
                rows={4}
                className="w-full"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSavePrompt}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEmailPrompt(campaign.email_prompt || "")
                    setIsEditingPrompt(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {emailPrompt || "No specific instructions - AI will use campaign context"}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <div className="font-medium">{contacts.length} contacts ready</div>
            <div className="text-sm text-muted-foreground">AI will generate personalized emails for each contact</div>
          </div>
          <Button onClick={handleGenerate} disabled={generating || contacts.length === 0}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Emails
              </>
            )}
          </Button>
        </div>

        {generating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Generating emails...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p>The AI will:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Create personalized subject lines</li>
            <li>Write custom email bodies based on contact information</li>
            <li>Keep emails professional and concise</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
