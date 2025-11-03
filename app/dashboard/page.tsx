import { StatsOverview } from "@/components/stats-overview"
import { DataQualityMonitor } from "@/components/data-quality-monitor"
import { AIProcessingPanel } from "@/components/ai-processing-panel"
import { RecentSearches } from "@/components/recent-searches"
import { IndustryBreakdown } from "@/components/industry-breakdown"
import { RecentCompanies } from "@/components/recent-companies"
import { CostAnalytics } from "@/components/cost-analytics"
import { Button } from "@/components/ui/button"
import { Search, Plus } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Company intelligence and analytics overview</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/search">
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Link>
              </Button>
              <Button asChild>
                <Link href="/search">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Company
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Stats Overview */}
          <StatsOverview />

          <CostAnalytics />

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <DataQualityMonitor />
            <AIProcessingPanel />
          </div>

          {/* Secondary Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            <RecentSearches />
            <IndustryBreakdown />
            <RecentCompanies />
          </div>
        </div>
      </div>
    </div>
  )
}
