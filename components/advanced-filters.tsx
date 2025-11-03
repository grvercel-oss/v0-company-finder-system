"use client"

import { useState } from "react"
import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

export interface FilterOptions {
  industry?: string
  location?: string
  size?: string
  verified?: boolean
}

interface AdvancedFiltersProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
}

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "E-commerce",
  "Manufacturing",
  "Education",
  "Real Estate",
  "Consulting",
  "Marketing",
  "Other",
]

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]

const LOCATIONS = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "France",
  "India",
  "Australia",
  "Singapore",
  "Other",
]

export function AdvancedFilters({ filters, onFiltersChange }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false)

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const clearFilters = () => {
    onFiltersChange({})
  }

  const removeFilter = (key: keyof FilterOptions) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    onFiltersChange(newFilters)
  }

  return (
    <div className="space-y-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="lg">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Advanced Filters</SheetTitle>
            <SheetDescription>Refine your search with advanced filtering options</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={filters.industry || ""}
                onValueChange={(value) => onFiltersChange({ ...filters, industry: value || undefined })}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={filters.location || ""}
                onValueChange={(value) => onFiltersChange({ ...filters, location: value || undefined })}
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Company Size</Label>
              <Select
                value={filters.size || ""}
                onValueChange={(value) => onFiltersChange({ ...filters, size: value || undefined })}
              >
                <SelectTrigger id="size">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="verified"
                checked={filters.verified || false}
                onChange={(e) => onFiltersChange({ ...filters, verified: e.target.checked || undefined })}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="verified" className="cursor-pointer">
                Verified companies only
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setOpen(false)} className="flex-1">
                Apply Filters
              </Button>
              <Button onClick={clearFilters} variant="outline">
                Clear
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.industry && (
            <Badge variant="secondary" className="gap-1">
              Industry: {filters.industry}
              <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter("industry")} />
            </Badge>
          )}
          {filters.location && (
            <Badge variant="secondary" className="gap-1">
              Location: {filters.location}
              <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter("location")} />
            </Badge>
          )}
          {filters.size && (
            <Badge variant="secondary" className="gap-1">
              Size: {filters.size}
              <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter("size")} />
            </Badge>
          )}
          {filters.verified && (
            <Badge variant="secondary" className="gap-1">
              Verified
              <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter("verified")} />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
