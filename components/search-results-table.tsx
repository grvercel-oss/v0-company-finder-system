"use client"
import type { Company } from "@/lib/db"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Building2, MapPin, Users, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface SearchResultsTableProps {
  companies: Company[]
  selectedCompanies: number[]
  onSelectionChange: (companyIds: number[]) => void
}

export function SearchResultsTable({ companies, selectedCompanies, onSelectionChange }: SearchResultsTableProps) {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(companies.map((c) => c.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectOne = (companyId: number, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedCompanies, companyId])
    } else {
      onSelectionChange(selectedCompanies.filter((id) => id !== companyId))
    }
  }

  const allSelected = companies.length > 0 && selectedCompanies.length === companies.length
  const someSelected = selectedCompanies.length > 0 && selectedCompanies.length < companies.length

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all companies"
                className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
              />
            </TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Employees</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id}>
              <TableCell>
                <Checkbox
                  checked={selectedCompanies.includes(company.id)}
                  onCheckedChange={(checked) => handleSelectOne(company.id, checked as boolean)}
                  aria-label={`Select ${company.name}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/companies/${company.id}`} className="font-medium hover:underline truncate">
                        {company.name}
                      </Link>
                      {company.verified && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {company.ai_summary || company.description || "No description"}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {company.industry ? (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {company.industry}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                {company.location ? (
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{company.location}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                {company.employee_count ? (
                  <div className="flex items-center gap-1 text-sm">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span>{company.employee_count}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm">{company.data_quality_score}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {company.website && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={company.website} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="default" size="sm" asChild>
                    <Link href={`/companies/${company.id}`}>View</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
