"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CompanyCard } from "@/components/company-card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Trash2, Rocket } from "lucide-react"
import Link from "next/link"
import type { Company } from "@/lib/db"
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
import { useToast } from "@/hooks/use-toast"

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
  const [companyToDelete, setCompanyToDelete] = useState<number | null>(null)
  const [creatingCampaign, setCreatingCampaign] = useState(false)

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

  const fetchCompanies = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}/companies`)
      const data = await response.json()
      setCompanies(data.companies || [])
    } catch (error) {
      console.error("Failed to fetch companies:", error)
    }
  }

  const handleRemoveCompany = async (companyId: number) => {
    try {
      const response = await fetch(`/api/lists/${listId}/companies?companyId=${companyId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setCompanies((prev) => prev.filter((c) => c.id !== companyId))
        setList((prev) => (prev ? { ...prev, company_count: prev.company_count - 1 } : null))
      }
    } catch (error) {
      console.error("Failed to remove company:", error)
    } finally {
      setCompanyToDelete(null)
    }
  }

  const handleCreateCampaign = async () => {
    if (companies.length === 0) {
      toast({
        title: "No companies",
        description: "Add companies to this list before creating a campaign",
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
        const { campaign } = await response.json()
        toast({
          title: "Campaign created",
          description: `Created campaign "${campaign.name}" with ${companies.length} companies and their contacts`,
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

  useEffect(() => {
    const fetchDetails = async () => {
      await fetchListDetails()
      await fetchCompanies()
    }

    fetchDetails()
  }, [listId])

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
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
            {companies.length} {companies.length === 1 ? "company" : "companies"}
          </p>
        </div>
        {companies.length > 0 && (
          <Button onClick={handleCreateCampaign} disabled={creatingCampaign} size="lg" className="gap-2">
            <Rocket className="h-5 w-5" />
            {creatingCampaign ? "Creating Campaign..." : "Create Campaign"}
          </Button>
        )}
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No companies in this list yet</p>
          <Link href="/search">
            <Button>Search Companies</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div key={company.id} className="relative">
              <CompanyCard company={company} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={() => setCompanyToDelete(company.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={companyToDelete !== null} onOpenChange={() => setCompanyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove company from list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the company from this list. The company data will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => companyToDelete && handleRemoveCompany(companyToDelete)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
