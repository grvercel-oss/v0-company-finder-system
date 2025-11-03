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
import { FolderPlus, Plus } from "lucide-react"
import { CreateListDialog } from "./create-list-dialog"

interface AddToListButtonProps {
  companyId: number
  companyName: string
}

export function AddToListButton({ companyId, companyName }: AddToListButtonProps) {
  const [lists, setLists] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const fetchLists = async () => {
    try {
      const response = await fetch("/api/lists")
      const data = await response.json()
      setLists(data.lists)
    } catch (error) {
      console.error("Failed to fetch lists:", error)
    }
  }

  useEffect(() => {
    fetchLists()
  }, [])

  const handleAddToList = async (listId: number, listName: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/lists/${listId}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      })

      if (response.ok) {
        alert(`Added ${companyName} to ${listName}`)
      } else if (response.status === 409) {
        alert(`${companyName} is already in ${listName}`)
      }
    } catch (error) {
      console.error("Failed to add company to list:", error)
      alert("Failed to add company to list")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Add to List
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
                <DropdownMenuItem key={list.id} onClick={() => handleAddToList(list.id, list.name)}>
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
