"use client"

import { Clock, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

interface SearchHistoryItem {
  id: string
  query: string
  resultsCount: number
  createdAt: string
}

interface SearchHistoryProps {
  history: SearchHistoryItem[]
  onSelectHistory: (searchId: string, query: string) => void
  isLoading?: boolean
}

export function SearchHistory({ history, onSelectHistory, isLoading }: SearchHistoryProps) {
  if (history.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Recent searches</span>
      </div>
      <div className="relative overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {history.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              className="h-auto py-2 px-3 flex flex-col items-start gap-1 hover:bg-accent hover:border-primary transition-colors bg-transparent flex-shrink-0 min-w-[300px]"
              onClick={() => onSelectHistory(item.id, item.query)}
              disabled={isLoading}
            >
              <div className="flex items-center gap-2 w-full">
                <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-sm text-left line-clamp-1">{item.query}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 w-full text-xs text-muted-foreground">
                <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                <span>-</span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {item.resultsCount} {item.resultsCount === 1 ? "result" : "results"}
                </Badge>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
