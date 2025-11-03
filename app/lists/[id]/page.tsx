"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CompanyCard } from "@/components/company-card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"

interface Company {
  id: number
  name: string
  domain: string
  description: string
  industry: string
  location: string
  website: string
  data_quality_score: number
  verified: boolean
  added_at: string
  notes: string | null
}

interface ListDetails {
  id: number
  name: string
  description: string | null
  created_at: string
}

export default function ListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const listId = params.id as string

  const [list, setList] = useState<ListDetails | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

    fetchListDetails()
  }, [listId])

  const handleRemoveCompany = async (companyId: number) => {
    if (!confirm("Remove this company from the list?")) return

    try {
      const response = await fetch(`/api/lists/${listId}/companies?companyId=${companyId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setCompanies((prev) => prev.filter((c) => c.id !== companyId))
      }
    } catch (error) {
      console.error("Failed to remove company:", error)
    }
  }

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

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{list.name}</h1>
        {list.description && <p className="text-muted-foreground mt-2">{list.description}</p>}
        <p className="text-sm text-muted-foreground mt-2">
          {companies.length} {companies.length === 1 ? "company" : "companies"}
        </p>
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
                onClick={() => handleRemoveCompany(company.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
