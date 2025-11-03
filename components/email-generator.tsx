"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  onComplete: () => void
}

export function EmailGenerator({ campaignId, contacts, onComplete }: EmailGeneratorProps) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleGenerate = async () => {
    if (contacts.length === 0) return

    setGenerating(true)
    setProgress(0)

    try {
      const contactIds = contacts.map((c) => c.id)
      const batchSize = 5 // Process 5 at a time

      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batch = contactIds.slice(i, i + batchSize)

        const response = await fetch("/api/emails/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, contactIds: batch }),
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
