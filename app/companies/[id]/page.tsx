import { sql } from "@/lib/db"
import { CompanyHeader } from "@/components/company-header"
import { CompanyOverview } from "@/components/company-overview"
import { CompanyUpdates } from "@/components/company-updates"
import { CompanyContacts } from "@/components/company-contacts"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idString } = await params
  const id = Number.parseInt(idString)

  if (isNaN(id)) {
    notFound()
  }

  const companyResult = await sql`
    SELECT * FROM companies WHERE id = ${id}
  `

  if (companyResult.length === 0) {
    notFound()
  }

  const company = companyResult[0]

  const updates = await sql`
    SELECT * FROM company_updates 
    WHERE company_id = ${id}
    ORDER BY updated_at DESC
    LIMIT 10
  `

  const contacts = await sql`
    SELECT * FROM company_contacts
    WHERE company_id = ${id}
    ORDER BY confidence_score DESC, created_at DESC
  `

  const safeJsonParse = (value: any) => {
    if (!value || value === "" || value === "null") return undefined
    try {
      return JSON.parse(value)
    } catch {
      return undefined
    }
  }

  const hasEnrichmentData = !!(company.ai_summary || company.technologies || company.funding_stage)

  const enrichmentData = hasEnrichmentData
    ? {
        summary: company.ai_summary,
        extractedInfo: {
          technologies: safeJsonParse(company.technologies),
          keywords: safeJsonParse(company.keywords),
          employee_count: company.employee_count,
          revenue_range: company.revenue_range,
          funding_stage: company.funding_stage,
          total_funding: company.total_funding,
          founded_year: company.founded_year,
          headquarters: company.headquarters,
          ceo_name: company.ceo_name,
          recent_news: company.recent_news,
          competitors: safeJsonParse(company.competitors),
        },
      }
    : undefined

  return (
    <div className="min-h-screen bg-background">
      <CompanyHeader company={company} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link href="/search">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          <CompanyOverview company={company} />
          <CompanyContacts contacts={contacts} />
          <CompanyUpdates
            updates={updates}
            companyId={company.id}
            companyName={company.name}
            hasEnrichmentData={hasEnrichmentData}
            enrichmentData={enrichmentData}
          />
        </div>
      </div>
    </div>
  )
}
