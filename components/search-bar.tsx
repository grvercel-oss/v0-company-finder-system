"use client"

import type React from "react"
import { useState } from "react"
import { Search, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SearchBarProps {
  onSearch: (query: string, companyCount: number) => void
  isLoading?: boolean
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [companyCount, setCompanyCount] = useState("10")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim(), parseInt(companyCount))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search for companies by name, industry, or keywords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11"
          disabled={isLoading}
        />
      </div>
      
      <Select value={companyCount} onValueChange={setCompanyCount} disabled={isLoading}>
        <SelectTrigger className="w-[140px] h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="5">5 companies</SelectItem>
          <SelectItem value="10">10 companies</SelectItem>
          <SelectItem value="20">20 companies</SelectItem>
          <SelectItem value="50">50 companies</SelectItem>
        </SelectContent>
      </Select>

      <Button type="submit" disabled={isLoading || !query.trim()} size="lg">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Searching
          </>
        ) : (
          "Search"
        )}
      </Button>
    </form>
  )
}
