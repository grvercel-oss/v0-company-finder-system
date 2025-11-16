"use client"
import type { Company } from "@/lib/db"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Building2, MapPin, Users, CheckCircle2, Mail, Zap } from 'lucide-react'
import Link from "next/link"
import { CompanyResearchModal } from "./company-research-modal"
import { ApolloContactModal } from "./apollo-contact-modal"
import { HunterEmailModal } from "./hunter-email-modal"
import { BulkAddToList } from "./bulk-add-to-list"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

interface SearchResultsTableProps {
  companies: Company[]
  selectedCompanies: number[]
  onSelectionChange: (companyIds: number[]) => void
}

interface CompanyContact {
  id: number
  company_id: number
  name: string
  role: string
  email: string
  phone?: string
  linkedin_url?: string
  confidence_score: number
  source?: string
  verified: boolean
  created_at: Date
  email_verification_status?: string
}

export function SearchResultsTable({ companies, selectedCompanies, onSelectionChange }: SearchResultsTableProps) {
  const [researchModalOpen, setResearchModalOpen] = useState(false)
  const [selectedCompanyForResearch, setSelectedCompanyForResearch] = useState<Company | null>(null)
  const [apolloModalOpen, setApolloModalOpen] = useState(false)
  const [selectedCompanyForApollo, setSelectedCompanyForApollo] = useState<Company | null>(null)
  const [hunterModalOpen, setHunterModalOpen] = useState(false)
  const [selectedCompanyForHunter, setSelectedCompanyForHunter] = useState<Company | null>(null)
  const [companyContacts, setCompanyContacts] = useState<Record<number, CompanyContact[]>>({})
  const { toast } = useToast()

  const fetchContacts = async (companyIds?: number[]) => {
    const companiesToFetch = companyIds ? companies.filter((c) => companyIds.includes(c.id)) : companies
    console.log(`[v0] [TABLE] Fetching contacts for ${companiesToFetch.length} companies`)
    const contactsMap: Record<number, CompanyContact[]> = { ...companyContacts }

    await Promise.all(
      companiesToFetch.map(async (company) => {
        try {
          const response = await fetch(`/api/companies/${company.id}/contacts`)
          if (response.ok) {
            const contacts = await response.json()
            console.log(`[v0] [TABLE] Company "${company.name}" has ${contacts.length} contacts`)
            contactsMap[company.id] = contacts
          }
        } catch (error) {
          console.error(`[v0] [TABLE] Failed to fetch contacts for company ${company.id}:`, error)
        }
      }),
    )

    setCompanyContacts(contactsMap)
  }

  useEffect(() => {
    if (companies.length > 0) {
      fetchContacts()
    }
  }, [companies])

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

  const handleGetMoreInfo = (company: Company) => {
    setSelectedCompanyForResearch(company)
    setResearchModalOpen(true)
  }

  const handleApolloContactSaved = async () => {
    if (selectedCompanyForApollo) {
      await fetchContacts([selectedCompanyForApollo.id])
    }
  }

  const handleHunterSearch = (company: Company) => {
    setSelectedCompanyForHunter(company)
    setHunterModalOpen(true)
  }

  const handleHunterContactSaved = async () => {
    if (selectedCompanyForHunter) {
      await fetchContacts([selectedCompanyForHunter.id])
    }
  }

  const handleApolloSearch = (company: Company) => {
    setSelectedCompanyForApollo(company)
    setApolloModalOpen(true)
  }

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    toast({
      title: "Email copied",
      description: "Email address copied to clipboard",
    })
  }

  const allSelected = companies.length > 0 && selectedCompanies.length === companies.length
  const someSelected = selectedCompanies.length > 0 && selectedCompanies.length < companies.length

  return (
    <>
      {selectedCompanies.length > 0 && (
        <div className="mb-4 flex items-center justify-between bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            {selectedCompanies.length} {selectedCompanies.length === 1 ? "company" : "companies"} selected
          </p>
          <BulkAddToList
            companyIds={selectedCompanies}
            onComplete={() => {
              onSelectionChange([])
              toast({
                title: "Companies added to list",
                description: `Successfully added ${selectedCompanies.length} companies to the list`,
              })
            }}
          />
        </div>
      )}

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
              <TableHead>Contacts</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => {
              const contacts = companyContacts[company.id] || []

              return (
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
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {company.logo_url ? (
                          <img
                            src={company.logo_url || "/placeholder.svg"}
                            alt={`${company.name} logo`}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none"
                              e.currentTarget.nextElementSibling?.classList.remove("hidden")
                            }}
                          />
                        ) : null}
                        <Building2 className={`h-5 w-5 text-muted-foreground ${company.logo_url ? "hidden" : ""}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/companies/${company.id}`} className="font-medium hover:underline truncate">
                            {company.name}
                          </Link>
                          {company.verified && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                        </div>
                        <p
                          className="text-sm text-muted-foreground line-clamp-1"
                          title={company.ai_summary || company.description || "No description"}
                        >
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
                    {contacts.length > 0 ? (
                      <div className="space-y-2 min-w-[250px]">
                        {contacts.slice(0, 2).map((contact) => (
                          <div key={contact.id} className="flex items-center gap-2 text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{contact.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{contact.role}</div>
                              {contact.source === "apollo.io" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4 border-blue-500/50 text-blue-600 mt-0.5"
                                >
                                  Apollo.io
                                </Badge>
                              )}
                              {contact.source === "hunter.io" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4 border-orange-500/50 text-orange-600 mt-0.5"
                                >
                                  Hunter.io
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 flex-shrink-0"
                              onClick={() => copyEmail(contact.email)}
                              title={contact.email}
                            >
                              <Mail className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {contacts.length > 2 && (
                          <Link href={`/companies/${company.id}`} className="text-xs text-primary hover:underline">
                            +{contacts.length - 2} more
                          </Link>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No contacts</span>
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
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleHunterSearch(company)}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Get contact from Hunter
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApolloSearch(company)}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Get contact from Apollo
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {selectedCompanyForResearch && (
        <CompanyResearchModal
          companyId={selectedCompanyForResearch.id}
          companyName={selectedCompanyForResearch.name}
          open={researchModalOpen}
          onOpenChange={setResearchModalOpen}
        />
      )}

      {selectedCompanyForApollo && (
        <ApolloContactModal
          companyName={selectedCompanyForApollo.name}
          companyId={selectedCompanyForApollo.id}
          domain={selectedCompanyForApollo.website?.replace(/^https?:\/\//i, "").split("/")[0] || ""}
          open={apolloModalOpen}
          onOpenChange={setApolloModalOpen}
          onContactSaved={handleApolloContactSaved}
        />
      )}

      {selectedCompanyForHunter && (
        <HunterEmailModal
          companyName={selectedCompanyForHunter.name}
          companyId={selectedCompanyForHunter.id}
          domain={selectedCompanyForHunter.website?.replace(/^https?:\/\//i, "").split("/")[0] || ""}
          open={hunterModalOpen}
          onOpenChange={setHunterModalOpen}
          onContactSaved={handleHunterContactSaved}
        />
      )}
    </>
  )
}
