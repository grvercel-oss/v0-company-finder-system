"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, Trash2, Briefcase, Building2, Target, Users, Star, Lightbulb, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ListCardProps {
  list: {
    id: number
    name: string
    description: string | null
    company_count: number
    created_at: string
    icon?: string
    color?: string
  }
  onDelete?: (id: number) => void
}

const ICON_MAP: Record<string, any> = {
  folder: FolderOpen,
  briefcase: Briefcase,
  building: Building2,
  target: Target,
  users: Users,
  star: Star,
  lightbulb: Lightbulb,
  trending: TrendingUp,
}

const COLOR_MAP: Record<string, string> = {
  gray: "text-gray-500",
  blue: "text-blue-500",
  green: "text-green-500",
  purple: "text-purple-500",
  orange: "text-orange-500",
  pink: "text-pink-500",
  red: "text-red-500",
  accent: "text-accent",
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

  const IconComponent = ICON_MAP[list.icon || "folder"] || FolderOpen
  const iconColor = COLOR_MAP[list.color || "gray"] || "text-gray-500"

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <IconComponent className={cn("h-5 w-5", iconColor)} />
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
