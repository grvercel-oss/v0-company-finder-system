"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { EmailEditorDialog } from "@/components/email-editor-dialog"

interface Contact {
  id: number
  email: string
  first_name: string
  last_name: string
  company_name: string
  job_title: string
  status: string
  failed_reason?: string
  created_at: string
  subject?: string
  body?: string
}

interface ContactsListProps {
  contacts: Contact[]
  onUpdate: () => void
}

export function ContactsList({ contacts, onUpdate }: ContactsListProps) {
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this contact?")) return

    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete contact")

      onUpdate()
    } catch (error) {
      console.error("Delete error:", error)
      alert("Failed to delete contact")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "default"
      case "generated":
        return "secondary"
      case "failed":
        return "destructive"
      case "replied":
        return "default"
      default:
        return "outline"
    }
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">No contacts yet. Upload a CSV file to get started.</div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Job Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>
                {contact.first_name || contact.last_name ? `${contact.first_name} ${contact.last_name}`.trim() : "-"}
              </TableCell>
              <TableCell>{contact.email}</TableCell>
              <TableCell>{contact.company_name || "-"}</TableCell>
              <TableCell>{contact.job_title || "-"}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant={getStatusColor(contact.status)}>{contact.status}</Badge>
                  {contact.status === "failed" && contact.failed_reason && (
                    <span className="text-xs text-destructive line-clamp-2" title={contact.failed_reason}>
                      {contact.failed_reason}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {(contact.status === "generated" || contact.status === "failed") &&
                    contact.subject &&
                    contact.body && <EmailEditorDialog contact={contact} onUpdate={onUpdate} />}
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
