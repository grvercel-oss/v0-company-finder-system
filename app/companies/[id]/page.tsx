import { sql } from "@/lib/db"
import { CompanyHeader } from "@/components/company-header"
import { CompanyOverview } from "@/components/company-overview"
import { CompanyUpdates } from "@/components/company-updates"
import { CompanyContacts } from "@/components/company-contacts"
import { EditCompanyDialog } from "@/components/edit-company-dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function CompanyPage({ params }: { params: { id: string } }) {
  const id = Number.parseInt(params.id)

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
          <EditCompanyDialog company={company} />
        </div>

        <div className="space-y-6">
          <CompanyOverview company={company} />
          <CompanyContacts contacts={contacts} />
          <CompanyUpdates updates={updates} />
        </div>
      </div>
    </div>
  )
}
