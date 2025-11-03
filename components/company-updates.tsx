"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import type { CompanyUpdate } from "@/lib/db"

interface CompanyUpdatesProps {
  updates: CompanyUpdate[]
}

export function CompanyUpdates({ updates }: CompanyUpdatesProps) {
  if (updates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Update History</CardTitle>
          <CardDescription>Track changes and updates to company data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No updates recorded yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update History</CardTitle>
        <CardDescription>Track changes and updates to company data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {updates.map((update) => (
            <div key={update.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
              <Clock className="h-4 w-4 text-muted-foreground mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    {update.update_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(update.updated_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {update.changes && (
                  <div className="text-sm text-muted-foreground">
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(update.changes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
