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
      let successCount = 0
      let duplicateCount = 0
      let errorCount = 0

      for (const companyId of companyIds) {
        try {
          const response = await fetch(`/api/lists/${listId}/companies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId }),
          })

          if (response.ok) {
            successCount++
          } else if (response.status === 409) {
            duplicateCount++
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
        }
      }

      toast({
        title: "Companies added to list",
        description: `${successCount} added, ${duplicateCount} already in list, ${errorCount} failed`,
      })

      onComplete?.()
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
          <DropdownMenuLabel>Add to List</DropdownMenuLabel>
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
                  {list.name}
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
        <CreateListDialog
          onListCreated={() => {
            fetchLists()
            setShowCreateDialog(false)
          }}
        />
      )}
    </>
  )
}
