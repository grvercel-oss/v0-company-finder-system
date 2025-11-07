"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Sparkles, Send } from "lucide-react"
import { CSVUpload } from "@/components/csv-upload"
import { ContactsList } from "@/components/contacts-list"
import { EmailGenerator } from "@/components/email-generator"
import { EmailSender } from "@/components/email-sender"

interface Contact {
  id: number
  email: string
  first_name: string
  last_name: string
  company_name: string
  job_title: string
  status: string
  subject: string
  body: string
  sent_at: string
  created_at: string
}

interface ContactsManagerProps {
  campaignId: string
  contacts: Contact[]
  onUpdate: () => void
}

export function ContactsManager({ campaignId, contacts, onUpdate }: ContactsManagerProps) {
  const [activeTab, setActiveTab] = useState("contacts")

  const pendingContacts = contacts.filter((c) => c.status === "pending")
  const generatedContacts = contacts.filter((c) => c.status === "generated")
  const sentContacts = contacts.filter((c) => c.status === "sent")
  const failedContacts = contacts.filter((c) => c.status === "failed")

  console.log("[v0] ContactsManager - Total contacts:", contacts.length)
  console.log("[v0] ContactsManager - Pending contacts:", pendingContacts.length)
  console.log("[v0] ContactsManager - Generated contacts:", generatedContacts.length)
  console.log(
    "[v0] ContactsManager - Contact statuses:",
    contacts.map((c) => ({ name: c.first_name, status: c.status })),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Management</CardTitle>
        <CardDescription>Upload contacts, generate emails, and send your outreach</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contacts">
              <Upload className="h-4 w-4 mr-2" />
              Contacts ({contacts.length})
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="generate" disabled={contacts.length === 0}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate ({pendingContacts.length})
            </TabsTrigger>
            <TabsTrigger value="send" disabled={generatedContacts.length === 0 && failedContacts.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              Send ({generatedContacts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            <ContactsList contacts={contacts} onUpdate={onUpdate} campaignId={campaignId} />
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <CSVUpload
              campaignId={campaignId}
              onUploadComplete={() => {
                onUpdate()
                setActiveTab("generate")
              }}
            />
          </TabsContent>

          <TabsContent value="generate" className="space-y-4">
            <EmailGenerator
              campaignId={campaignId}
              contacts={pendingContacts}
              onComplete={() => {
                onUpdate()
                setActiveTab("send")
              }}
            />
          </TabsContent>

          <TabsContent value="send" className="space-y-4">
            <EmailSender
              campaignId={campaignId}
              contacts={generatedContacts}
              failedContacts={failedContacts}
              onComplete={() => {
                onUpdate()
                setActiveTab("contacts")
              }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
