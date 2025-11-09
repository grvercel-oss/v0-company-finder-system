"use client"

import { useEffect, useState } from "react"
import { CreateListDialog } from "@/components/create-list-dialog"
import { ListCard } from "@/components/list-card"
import { Skeleton } from "@/components/ui/skeleton"
import { FolderOpen } from "lucide-react"

interface CompanyList {
  id: number
  name: string
  description: string | null
  company_count: number
  created_at: string
  icon?: string
  color?: string
}

export default function ListsPage() {
  const [lists, setLists] = useState<CompanyList[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLists = async () => {
    try {
      const response = await fetch("/api/lists")
      const data = await response.json()

      if (data.lists) {
        setLists(data.lists)
      } else {
        console.error("Failed to fetch lists:", data.error)
        setLists([])
      }
    } catch (error) {
      console.error("Failed to fetch lists:", error)
      setLists([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLists()
  }, [])

  const handleListDeleted = (id: number) => {
    setLists((prev) => prev.filter((list) => list.id !== id))
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Company Lists</h1>
          <p className="text-muted-foreground mt-2">Organize and manage your saved companies</p>
        </div>
        <CreateListDialog onListCreated={fetchLists} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No lists yet</h3>
          <p className="text-muted-foreground mb-4">Create your first list to start organizing companies</p>
          <CreateListDialog onListCreated={fetchLists} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} onDelete={handleListDeleted} />
          ))}
        </div>
      )}
    </div>
  )
}
