"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Rocket, Trash2 } from "lucide-react"
import Link from "next/link"
import type { Company } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { SearchResultsTable } from "@/components/search-results-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ListDetails {
  id: number
  name: string
  description: string | null
  created_at: string
  company_count: number
}

export default function ListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const listId = params.id as string
  const { toast } = useToast()

  const [list, setList] = useState<ListDetails | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [contactCounts, setContactCounts] = useState<Record<number, number>>({})

  const fetchListDetails = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}`)
      const data = await response.json()
      setList(data.list)
      setCompanies(data.companies)
    } catch (error) {
      console.error("Failed to fetch list details:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchContactCounts = async () => {
    try {
      const counts: Record<number, number> = {}
      for (const company of companies) {
        const response = await fetch(`/api/companies/${company.id}/contacts`)
        const data = await response.json()
        const validContacts = data.contacts?.filter((c: any) => c.email_verification_status !== "invalid") || []
        counts[company.id] = validContacts.length
      }
      setContactCounts(counts)
    } catch (error) {
      console.error("Failed to fetch contact counts:", error)
    }
  }

  const handleCreateCampaign = async () => {
    const totalContacts = Object.values(contactCounts).reduce((sum, count) => sum + count, 0)

    if (companies.length === 0) {
      toast({
        title: "No companies",
        description: "Add companies to this list before creating a campaign",
        variant: "destructive",
      })
      return
    }

    if (totalContacts === 0) {
      toast({
        title: "No contacts found",
        description: "Use Hunter.io to get executive emails before creating a campaign",
        variant: "destructive",
      })
      return
    }

    setCreatingCampaign(true)
    try {
      const response = await fetch("/api/campaigns/from-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId: Number.parseInt(listId),
          listName: list?.name,
        }),
      })

      if (response.ok) {
        const { campaign, contactCount } = await response.json()
        toast({
          title: "Campaign created",
          description: `Created campaign "${campaign.name}" with ${companies.length} companies and ${contactCount} contacts`,
        })
        router.push(`/campaigns/${campaign.id}`)
      } else {
        const error = await response.json()
        toast({
          title: "Failed to create campaign",
          description: error.error || "An error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to create campaign:", error)
      toast({
        title: "Failed to create campaign",
        description: "An error occurred while creating the campaign",
        variant: "destructive",
      })
    } finally {
      setCreatingCampaign(false)
    }
  }

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedCompanies.map((companyId) =>
          fetch(`/api/lists/${listId}/companies?companyId=${companyId}`, {
            method: "DELETE",
          }),
        ),
      )

      toast({
        title: "Companies removed",
        description: `Removed ${selectedCompanies.length} companies from list`,
      })

      setCompanies((prev) => prev.filter((c) => !selectedCompanies.includes(c.id)))
      setSelectedCompanies([])
      setShowDeleteDialog(false)
    } catch (error) {
      console.error("Failed to remove companies:", error)
      toast({
        title: "Failed to remove companies",
        description: "An error occurred while removing companies",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    fetchListDetails()
  }, [listId])

  useEffect(() => {
    if (companies.length > 0) {
      fetchContactCounts()
    }
  }, [companies])

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!list) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">List not found</h2>
        <Link href="/lists">
          <Button>Back to Lists</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Link href="/lists">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Lists
        </Button>
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{list.name}</h1>
          {list.description && <p className="text-muted-foreground mt-2">{list.description}</p>}
          <p className="text-sm text-muted-foreground mt-2">
            {companies.length} {companies.length === 1 ? "company" : "companies"} •{" "}
            {Object.values(contactCounts).reduce((sum, count) => sum + count, 0)} contacts
          </p>
        </div>
        <div className="flex gap-2">
          {selectedCompanies.length > 0 && (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Remove Selected ({selectedCompanies.length})
            </Button>
          )}
          {companies.length > 0 && (
            <Button onClick={handleCreateCampaign} disabled={creatingCampaign} size="lg" className="gap-2">
              <Rocket className="h-5 w-5" />
              {creatingCampaign ? "Creating Campaign..." : "Create Campaign"}
            </Button>
          )}
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No companies in this list yet</p>
          <Link href="/search">
            <Button>Search Companies</Button>
          </Link>
        </div>
      ) : (
        <SearchResultsTable
          companies={companies}
          selectedCompanies={selectedCompanies}
          onSelectionChange={setSelectedCompanies}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedCompanies.length} companies from list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected companies from this list. The company data will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
