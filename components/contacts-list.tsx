"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { EmailEditorDialog } from "@/components/email-editor-dialog"
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
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleBulkDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/contacts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selectedContacts) }),
      })

      if (!response.ok) throw new Error("Failed to delete contacts")

      setSelectedContacts(new Set())
      setShowBulkDeleteDialog(false)
      onUpdate()
    } catch (error) {
      console.error("Bulk delete error:", error)
      alert("Failed to delete contacts")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(new Set(contacts.map((c) => c.id)))
    } else {
      setSelectedContacts(new Set())
    }
  }

  const handleSelectContact = (contactId: number, checked: boolean) => {
    const newSelected = new Set(selectedContacts)
    if (checked) {
      newSelected.add(contactId)
    } else {
      newSelected.delete(contactId)
    }
    setSelectedContacts(newSelected)
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

  const allSelected = contacts.length > 0 && selectedContacts.size === contacts.length
  const someSelected = selectedContacts.size > 0 && selectedContacts.size < contacts.length

  return (
    <div className="space-y-4">
      {selectedContacts.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedContacts.size} contact{selectedContacts.size !== 1 ? "s" : ""} selected
          </span>
          <Button variant="destructive" onClick={() => setShowBulkDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all contacts"
                  className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                />
              </TableHead>
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
                  <Checkbox
                    checked={selectedContacts.has(contact.id)}
                    onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                    aria-label={`Select ${contact.email}`}
                  />
                </TableCell>
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

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedContacts.size} contact{selectedContacts.size !== 1 ? "s" : ""}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
