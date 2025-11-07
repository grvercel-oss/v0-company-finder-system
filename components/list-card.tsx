"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, Trash2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

interface ListCardProps {
  list: {
    id: number
    name: string
    description: string | null
    company_count: number
    created_at: string
  }
  onDelete?: (id: number) => void
}

export function ListCard({ list, onDelete }: ListCardProps) {
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${list.name}"?`)) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete list")
      }

      toast({
        title: "List deleted",
        description: `"${list.name}" has been deleted successfully.`,
      })

      onDelete?.(list.id)
    } catch (error: any) {
      console.error("Failed to delete list:", error)
      toast({
        title: "Error deleting list",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{list.name}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDelete} className="h-8 w-8" disabled={isDeleting}>
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
        {list.description && <CardDescription className="mt-2">{list.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {list.company_count} {list.company_count === 1 ? "company" : "companies"}
          </p>
          <Link href={`/lists/${list.id}`}>
            <Button variant="outline" size="sm">
              View List
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
