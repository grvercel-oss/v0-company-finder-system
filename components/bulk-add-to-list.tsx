"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FolderPlus, Plus, Loader2 } from "lucide-react"
import { CreateListDialog } from "./create-list-dialog"
import { useToast } from "@/hooks/use-toast"

interface BulkAddToListProps {
  companyIds: number[]
  onComplete?: () => void
}

export function BulkAddToList({ companyIds, onComplete }: BulkAddToListProps) {
  const [lists, setLists] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const { toast } = useToast()

  const fetchLists = async () => {
    try {
      const response = await fetch("/api/lists")
      const data = await response.json()
      setLists(data.lists || [])
    } catch (error) {
      console.error("Failed to fetch lists:", error)
    }
  }

  useEffect(() => {
    fetchLists()
  }, [])

  const handleBulkAddToList = async (listId: number, listName: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/lists/${listId}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Companies added",
          description: `${data.added} added to ${listName}${data.duplicates > 0 ? `, ${data.duplicates} already in list` : ""}`,
        })
        onComplete?.()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to add companies to list",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to add companies to list:", error)
      toast({
        title: "Error",
        description: "Failed to add companies to list",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={loading || companyIds.length === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <FolderPlus className="mr-2 h-4 w-4" />
                Add {companyIds.length} to List
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Add {companyIds.length} companies to...</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {lists.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              <p className="mb-2">No lists yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create List
              </Button>
            </div>
          ) : (
            <>
              {lists.map((list) => (
                <DropdownMenuItem key={list.id} onClick={() => handleBulkAddToList(list.id, list.name)}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  {list.name} ({list.company_count || 0})
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create New List
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showCreateDialog && (
        <CreateListDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onListCreated={fetchLists} />
      )}
    </>
  )
}
