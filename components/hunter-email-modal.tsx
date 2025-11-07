"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Linkedin,
  Twitter,
  TrendingUp,
  Building2,
  X,
} from "lucide-react"

interface Executive {
  value: string
  confidence: number
  first_name: string
  last_name: string
  position: string
  seniority: string
  department: string
  linkedin: string | null
  twitter: string | null
  verification: {
    status: string
  } | null
}

interface HunterEmailModalProps {
  companyName: string
  companyId: number
  domain: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactSaved?: () => void
}

export function HunterEmailModal({
  companyName,
  companyId,
  domain,
  open,
  onOpenChange,
  onContactSaved,
}: HunterEmailModalProps) {
  const [executives, setExecutives] = useState<Executive[]>([])
  const [loading, setLoading] = useState(false)
  const [revealedEmails, setRevealedEmails] = useState<Set<string>>(new Set())
  const [revealingEmail, setRevealingEmail] = useState<string | null>(null)
  const [totalFound, setTotalFound] = useState(0)
  const { toast } = useToast()

  const searchExecutives = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/hunter/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, companyName }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to search")
      }

      const data = await response.json()
      setExecutives(data.executives)
      setTotalFound(data.totalFound)

      if (data.executivesFound === 0) {
        toast({
          title: "No executives found",
          description: `Found ${data.totalFound} total emails, but no executive positions were identified.`,
        })
      } else {
        toast({
          title: "Executives found",
          description: `Found ${data.executivesFound} executive contacts at ${companyName}`,
        })
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const revealEmail = async (executive: Executive) => {
    const key = `${executive.first_name}-${executive.last_name}`
    setRevealingEmail(key)

    try {
      const response = await fetch("/api/hunter/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          firstName: executive.first_name,
          lastName: executive.last_name,
          companyId,
          companyName,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to reveal email")
      }

      const data = await response.json()
      setRevealedEmails((prev) => new Set([...prev, key]))

      setExecutives((prev) =>
        prev.map((exec) =>
          exec.first_name === executive.first_name && exec.last_name === executive.last_name
            ? { ...exec, value: data.email, verification: data.verification }
            : exec,
        ),
      )

      toast({
        title: "Email revealed & saved",
        description: `${executive.first_name} ${executive.last_name}'s email has been saved to ${companyName}'s contacts`,
      })

      onContactSaved?.()
    } catch (error: any) {
      toast({
        title: "Failed to reveal email",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setRevealingEmail(null)
    }
  }

  const copyEmail = (email: string, name: string) => {
    navigator.clipboard.writeText(email)
    toast({
      title: "Email copied",
      description: `${name}'s email copied to clipboard`,
    })
  }

  useState(() => {
    if (open && executives.length === 0) {
      searchExecutives()
    }
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Hunter.io Executive Finder</h2>
              <p className="text-sm text-muted-foreground">Find and reveal executive emails for {companyName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm text-muted-foreground">Searching Hunter.io for executives...</p>
            </div>
          ) : executives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {totalFound > 0 ? `Found ${totalFound} emails but no executive positions identified` : "No results yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {executives.length} executive{executives.length !== 1 ? "s" : ""} at {domain}
                </p>
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Sorted by seniority & confidence
                </Badge>
              </div>

              <div className="grid gap-3">
                {executives.map((exec) => {
                  const key = `${exec.first_name}-${exec.last_name}`
                  const isRevealed = revealedEmails.has(key)
                  const isRevealing = revealingEmail === key

                  return (
                    <div key={key} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">
                              {exec.first_name} {exec.last_name}
                            </h3>
                            {exec.seniority === "executive" && (
                              <Badge className="bg-orange-500 text-white">Executive</Badge>
                            )}
                            {exec.seniority === "senior" && <Badge variant="secondary">Senior</Badge>}
                          </div>

                          <p className="text-sm text-muted-foreground mb-2">{exec.position}</p>

                          <div className="flex items-center gap-3 mb-3">
                            {exec.department && (
                              <Badge variant="outline" className="text-xs">
                                {exec.department}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <TrendingUp className="h-3 w-3" />
                              {exec.confidence}% confidence
                            </div>
                          </div>

                          {isRevealed ? (
                            <div className="flex items-center gap-2">
                              <code className="px-2 py-1 bg-muted rounded text-sm font-mono">{exec.value}</code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyEmail(exec.value, `${exec.first_name} ${exec.last_name}`)}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                              {exec.verification && (
                                <Badge
                                  variant={
                                    exec.verification.status === "valid"
                                      ? "default"
                                      : exec.verification.status === "invalid"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                  className="gap-1"
                                >
                                  {exec.verification.status === "valid" && <CheckCircle2 className="h-3 w-3" />}
                                  {exec.verification.status === "invalid" && <AlertCircle className="h-3 w-3" />}
                                  {exec.verification.status}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => revealEmail(exec)}
                              disabled={isRevealing}
                              className="bg-orange-500 hover:bg-orange-600"
                            >
                              {isRevealing ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                  Revealing...
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 mr-2" />
                                  Reveal Email (1 credit)
                                </>
                              )}
                            </Button>
                          )}
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          {exec.linkedin && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={exec.linkedin} target="_blank" rel="noopener noreferrer">
                                <Linkedin className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {exec.twitter && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={`https://twitter.com/${exec.twitter}`} target="_blank" rel="noopener noreferrer">
                                <Twitter className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between flex-shrink-0 bg-muted/30">
          <p className="text-xs text-muted-foreground">💳 Each revealed email costs 1 Hunter.io credit</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
