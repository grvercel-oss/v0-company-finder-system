"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Loader2,
  FolderOpen,
  Briefcase,
  Building2,
  Target,
  Users,
  Star,
  Lightbulb,
  TrendingUp,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface CreateListDialogProps {
  onListCreated?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const ICON_OPTIONS = [
  { name: "folder", icon: FolderOpen },
  { name: "briefcase", icon: Briefcase },
  { name: "building", icon: Building2 },
  { name: "target", icon: Target },
  { name: "users", icon: Users },
  { name: "star", icon: Star },
  { name: "lightbulb", icon: Lightbulb },
  { name: "trending", icon: TrendingUp },
]

const COLOR_OPTIONS = [
  { name: "gray", value: "text-gray-500" },
  { name: "blue", value: "text-blue-500" },
  { name: "green", value: "text-green-500" },
  { name: "purple", value: "text-purple-500" },
  { name: "orange", value: "text-orange-500" },
  { name: "pink", value: "text-pink-500" },
  { name: "red", value: "text-red-500" },
  { name: "accent", value: "text-accent" },
]

export function CreateListDialog({ onListCreated, open: controlledOpen, onOpenChange }: CreateListDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("folder")
  const [selectedColor, setSelectedColor] = useState("gray")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "List name is required",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, icon: selectedIcon, color: selectedColor }),
      })

      if (response.ok) {
        toast({
          title: "List created",
          description: `Created list "${name}"`,
        })
        setName("")
        setDescription("")
        setSelectedIcon("folder")
        setSelectedColor("gray")
        setOpen(false)
        onListCreated?.()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to create list",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to create list:", error)
      toast({
        title: "Error",
        description: "Failed to create list",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create List
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New List</DialogTitle>
          <DialogDescription>Create a new list to organize your companies</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">List Name</Label>
            <Input
              id="name"
              placeholder="e.g., AI Startups in Europe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add a description for this list..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-2">
              {ICON_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setSelectedIcon(option.name)}
                    className={cn(
                      "p-3 rounded-lg border-2 hover:border-accent transition-colors flex items-center justify-center",
                      selectedIcon === option.name ? "border-accent bg-accent/10" : "border-border",
                    )}
                    disabled={loading}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-8 gap-2">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => setSelectedColor(option.name)}
                  className={cn(
                    "p-3 rounded-lg border-2 hover:border-accent transition-colors flex items-center justify-center",
                    selectedColor === option.name ? "border-accent bg-accent/10" : "border-border",
                  )}
                  disabled={loading}
                >
                  <div className={cn("h-5 w-5 rounded-full", option.value.replace("text-", "bg-"))} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create List"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
