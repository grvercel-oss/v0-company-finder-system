"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Mail,
  Loader2,
  CheckCircle2,
  Linkedin,
  Twitter,
  TrendingUp,
  Building2,
  X,
  Rocket,
  Database,
  Zap,
} from "lucide-react"

interface Executive {
  id: string
  email: string | null
  confidence: number
  first_name: string
  last_name: string
  position: string
  seniority: string
  department: string
  linkedin: string | null
  twitter: string | null
  photo_url: string | null
  email_status: string | null
}

interface Campaign {
  id: number
  name: string
  status: string
}

interface ApolloContactModalProps {
  companyName: string
  companyId: number
  domain: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactSaved?: () => void
}

export function ApolloContactModal({
  companyName,
  companyId,
  domain,
  open,
  onOpenChange,
  onContactSaved,
}: ApolloContactModalProps) {
  const [executives, setExecutives] = useState<Executive[]>([])
  const [loading, setLoading] = useState(false)
  const [totalFound, setTotalFound] = useState(0)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [savingContact, setSavingContact] = useState<string | null>(null)
  const [sendingToCampaign, setSendingToCampaign] = useState<string | null>(null)
  const [savedContactsSet, setSavedContactsSet] = useState<Set<string>>(new Set())
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return

    setExecutives([])
    setSelectedEmails(new Set())
    setSavedContactsSet(new Set())
    setTotalFound(0)
    setSelectedCampaign("")
    setUpgradeRequired(false)
    setLoading(true)

    const controller = new AbortController()

    Promise.all([
      fetch("/api/campaigns", { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setCampaigns(data.campaigns || []))
        .catch(() => {}),

      fetch(`/api/companies/${companyId}/contacts`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((contacts) => {
          if (contacts && Array.isArray(contacts)) {
            const savedSet = new Set<string>()
            contacts.forEach((contact: any) => {
              if (contact.email) {
                savedSet.add(contact.email.toLowerCase())
              }
            })
            setSavedContactsSet(savedSet)
          }
        })
        .catch(() => {}),

      fetch("/api/apollo/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, companyName }),
        signal: controller.signal,
      })
        .then((res) => {
          if (res.status === 402) {
            return res.json().then((data) => {
              setUpgradeRequired(true)
              throw new Error(data.message || "Upgrade required")
            })
          }
          return res.ok ? res.json() : Promise.reject(res)
        })
        .then((data) => {
          setExecutives(data.executives || [])
          setTotalFound(data.totalFound || 0)

          const count = data.executivesFound || 0
          if (count === 0) {
            toast({
              title: "No executives found",
              description: `No executive contacts found at ${companyName}`,
            })
          } else {
            toast({
              title: "Executives found",
              description: `Found ${count} executive contacts`,
            })
          }
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            toast({
              title: "Search failed",
              description: error.message || "Failed to search Apollo.io",
              variant: "destructive",
            })
          }
        }),
    ]).finally(() => {
      setLoading(false)
    })

    return () => {
      controller.abort()
    }
  }, [open, companyId, domain, companyName])

  const saveContact = async (executive: Executive) => {
    if (!executive.email) {
      toast({
        title: "No email available",
        description: "This contact does not have an email address",
        variant: "destructive",
      })
      return
    }

    setSavingContact(executive.id)

    try {
      const response = await fetch("/api/apollo/save-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          email: executive.email,
          firstName: executive.first_name,
          lastName: executive.last_name,
          position: executive.position,
          department: executive.department,
          linkedin: executive.linkedin,
          twitter: executive.twitter,
          photoUrl: executive.photo_url,
          emailStatus: executive.email_status,
          apolloId: executive.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save contact")
      }

      setSavedContactsSet((prev) => new Set([...prev, executive.email!.toLowerCase()]))

      toast({
        title: "Contact saved",
        description: `${executive.first_name} ${executive.last_name} saved to ${companyName}`,
      })

      onContactSaved?.()
    } catch (error: any) {
      toast({
        title: "Failed to save contact",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSavingContact(null)
    }
  }

  const sendToCampaign = async (executive: Executive) => {
    if (!selectedCampaign) {
      toast({
        title: "No campaign selected",
        description: "Please select a campaign first",
        variant: "destructive",
      })
      return
    }

    if (!executive.email) {
      toast({
        title: "No email available",
        description: "This contact does not have an email address",
        variant: "destructive",
      })
      return
    }

    setSendingToCampaign(executive.id)

    try {
      const response = await fetch("/api/apollo/add-to-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: Number.parseInt(selectedCampaign),
          companyId,
          email: executive.email,
          firstName: executive.first_name,
          lastName: executive.last_name,
          position: executive.position,
          department: executive.department,
          linkedin: executive.linkedin,
          twitter: executive.twitter,
          photoUrl: executive.photo_url,
          emailStatus: executive.email_status,
          apolloId: executive.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add to campaign")
      }

      const campaignName = campaigns.find((c) => c.id === Number.parseInt(selectedCampaign))?.name

      toast({
        title: "Added to campaign",
        description: `${executive.first_name} ${executive.last_name} added to "${campaignName}"`,
      })
    } catch (error: any) {
      toast({
        title: "Failed to add to campaign",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSendingToCampaign(null)
    }
  }

  const sendSelectedToCampaign = async () => {
    if (!selectedCampaign) {
      toast({
        title: "No campaign selected",
        description: "Please select a campaign first",
        variant: "destructive",
      })
      return
    }

    if (selectedEmails.size === 0) {
      toast({
        title: "No emails selected",
        description: "Please choose at least one email",
        variant: "destructive",
      })
      return
    }

    const selectedExecs = executives.filter((exec) => exec.email && selectedEmails.has(exec.email))

    let successCount = 0
    let errorCount = 0

    for (const exec of selectedExecs) {
      try {
        const response = await fetch("/api/apollo/add-to-campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: Number.parseInt(selectedCampaign),
            companyId,
            email: exec.email,
            firstName: exec.first_name,
            lastName: exec.last_name,
            position: exec.position,
            department: exec.department,
            linkedin: exec.linkedin,
            twitter: exec.twitter,
            photoUrl: exec.photo_url,
            emailStatus: exec.email_status,
            apolloId: exec.id,
          }),
        })

        if (response.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        errorCount++
      }
    }

    const campaignName = campaigns.find((c) => c.id === Number.parseInt(selectedCampaign))?.name

    toast({
      title: "Contacts added to campaign",
      description: `Successfully added ${successCount} contacts to "${campaignName}"${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
    })

    setSelectedEmails(new Set())
  }

  const copyEmail = (email: string, name: string) => {
    navigator.clipboard.writeText(email)
    toast({
      title: "Email copied",
      description: `${name}'s email copied to clipboard`,
    })
  }

  const toggleEmailSelection = (email: string) => {
    setSelectedEmails((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(email)) {
        newSet.delete(email)
      } else {
        newSet.add(email)
      }
      return newSet
    })
  }

  if (!open) return null

  const savedExecutives = executives.filter((exec) => exec.email && savedContactsSet.has(exec.email.toLowerCase()))
  const unsavedExecutives = executives.filter((exec) => !exec.email || !savedContactsSet.has(exec.email.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Apollo.io Executive Finder</h2>
              <p className="text-sm text-muted-foreground">Find executive contacts for {companyName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">Searching Apollo.io for executives...</p>
            </div>
          ) : upgradeRequired ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Zap className="h-8 w-8 text-amber-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Apollo.io Upgrade Required</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  The People Search API is not available on Apollo.io's free plan. Please upgrade your Apollo.io account
                  to access this feature.
                </p>
              </div>
              <Button asChild className="bg-blue-500 hover:bg-blue-600">
                <a href="https://app.apollo.io/" target="_blank" rel="noopener noreferrer">
                  Upgrade Apollo.io Plan
                </a>
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Alternative: Use Hunter.io integration which works on free tier
              </p>
            </div>
          ) : executives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No executive contacts found</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {executives.length} executives at {domain}
                  {savedExecutives.length > 0 && (
                    <span className="text-green-600 ml-2">• {savedExecutives.length} already saved</span>
                  )}
                </p>
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Sorted by seniority
                </Badge>
              </div>

              {campaigns.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg">
                  <Rocket className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Send to campaign:</span>
                  <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedEmails.size > 0 && selectedCampaign && (
                <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-lg">
                  <p className="text-sm font-medium">{selectedEmails.size} contacts selected</p>
                  <Button onClick={sendSelectedToCampaign} className="bg-accent hover:bg-accent/90 text-white">
                    <Rocket className="h-4 w-4 mr-2" />
                    Add to Campaign
                  </Button>
                </div>
              )}

              {savedExecutives.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-green-600" />
                    <h3 className="font-semibold text-green-600">Already Saved ({savedExecutives.length})</h3>
                  </div>

                  <div className="grid gap-3">
                    {savedExecutives.map((exec) => {
                      const isSelected = exec.email ? selectedEmails.has(exec.email) : false
                      const isSending = sendingToCampaign === exec.id

                      return (
                        <div key={exec.id} className="border border-green-500/20 bg-green-500/5 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            {exec.email && (
                              <div className="flex items-start pt-1">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleEmailSelection(exec.email!)}
                                  className="border-green-500 data-[state=checked]:bg-green-500"
                                />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">
                                  {exec.first_name} {exec.last_name}
                                </h3>
                                {exec.seniority === "executive" && (
                                  <Badge className="bg-blue-500 text-white">Executive</Badge>
                                )}
                                {exec.seniority === "senior" && <Badge variant="secondary">Senior</Badge>}
                                <Badge
                                  variant="outline"
                                  className="gap-1 bg-green-500/10 text-green-600 border-green-500/20"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Saved
                                </Badge>
                              </div>

                              <p className="text-sm text-muted-foreground mb-2">{exec.position}</p>

                              <div className="flex items-center gap-3 mb-3">
                                {exec.department && (
                                  <Badge variant="outline" className="text-xs">
                                    {exec.department}
                                  </Badge>
                                )}
                                {exec.email_status && (
                                  <Badge
                                    variant={exec.email_status === "verified" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {exec.email_status}
                                  </Badge>
                                )}
                              </div>

                              {exec.email && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <code className="px-2 py-1 bg-muted rounded text-sm font-mono">{exec.email}</code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyEmail(exec.email!, `${exec.first_name} ${exec.last_name}`)}
                                    >
                                      <Mail className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                  </div>
                                  {selectedCampaign && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => sendToCampaign(exec)}
                                      disabled={isSending}
                                      className="border-accent text-accent hover:bg-accent/10"
                                    >
                                      {isSending ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                          Adding...
                                        </>
                                      ) : (
                                        <>
                                          <Rocket className="h-3 w-3 mr-2" />
                                          Send to Campaign
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
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
                                  <a
                                    href={`https://twitter.com/${exec.twitter}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
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

              {unsavedExecutives.length > 0 && (
                <div className="space-y-3">
                  {savedExecutives.length > 0 && (
                    <div className="flex items-center gap-2 pt-3 border-t">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <h3 className="font-semibold text-blue-500">New Contacts ({unsavedExecutives.length})</h3>
                    </div>
                  )}

                  <div className="grid gap-3">
                    {unsavedExecutives.map((exec) => {
                      const isSaving = savingContact === exec.id
                      const isSending = sendingToCampaign === exec.id
                      const isSelected = exec.email ? selectedEmails.has(exec.email) : false

                      return (
                        <div key={exec.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            {exec.email && (
                              <div className="flex items-start pt-1">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleEmailSelection(exec.email!)}
                                  className="border-blue-500 data-[state=checked]:bg-blue-500"
                                />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">
                                  {exec.first_name} {exec.last_name}
                                </h3>
                                {exec.seniority === "executive" && (
                                  <Badge className="bg-blue-500 text-white">Executive</Badge>
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
                                {exec.email_status && (
                                  <Badge
                                    variant={exec.email_status === "verified" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {exec.email_status}
                                  </Badge>
                                )}
                              </div>

                              {exec.email ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <code className="px-2 py-1 bg-muted rounded text-sm font-mono">{exec.email}</code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyEmail(exec.email!, `${exec.first_name} ${exec.last_name}`)}
                                    >
                                      <Mail className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => saveContact(exec)}
                                      disabled={isSaving}
                                      className="bg-blue-500 hover:bg-blue-600"
                                    >
                                      {isSaving ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        <>
                                          <Database className="h-3 w-3 mr-2" />
                                          Save Contact
                                        </>
                                      )}
                                    </Button>
                                    {selectedCampaign && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => sendToCampaign(exec)}
                                        disabled={isSending}
                                        className="border-accent text-accent hover:bg-accent/10"
                                      >
                                        {isSending ? (
                                          <>
                                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                            Adding...
                                          </>
                                        ) : (
                                          <>
                                            <Rocket className="h-3 w-3 mr-2" />
                                            Send to Campaign
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  No email available
                                </Badge>
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
                                  <a
                                    href={`https://twitter.com/${exec.twitter}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
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
          )}
        </div>

        <div className="border-t p-4 flex items-center justify-between flex-shrink-0 bg-muted/30">
          <p className="text-xs text-muted-foreground">Apollo.io searches use credits • Emails included in results</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
