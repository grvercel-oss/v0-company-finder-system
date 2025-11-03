"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  Zap,
  TrendingUp,
  Calendar,
  AlertCircle,
  Building2,
  Search,
  Mail,
  Users,
  MessageSquare,
  Activity,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface CostAnalytics {
  totals: Array<{
    total_cost: string
    total_tokens: number
    total_generations: number
    model: string
  }>
  byCampaign: Array<{
    id: number
    name: string
    total_cost: string
    total_tokens: number
    generation_count: number
  }>
  recentUsage: Array<{
    id: number
    campaign_name: string
    contact_email: string
    first_name: string
    last_name: string
    model: string
    total_tokens: number
    cost_usd: string
    generation_type: string
    created_at: string
  }>
  dailyCosts: Array<{
    date: string
    cost: string
    tokens: number
    generations: number
  }>
}

interface OverviewAnalytics {
  companies: {
    total: number
    verified: number
    averageQuality: number
  }
  searches: {
    total: number
    totalCost: number
  }
  campaigns: {
    total: number
    active: number
  }
  contacts: {
    total: number
    sent: number
    replied: number
    replyRate: number
  }
}

export default function AnalyticsPage() {
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics | null>(null)
  const [overviewAnalytics, setOverviewAnalytics] = useState<OverviewAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const [costsResponse, overviewResponse] = await Promise.all([
        fetch("/api/analytics/costs"),
        fetch("/api/analytics/overview"),
      ])

      const costsData = await costsResponse.json()
      const overviewData = await overviewResponse.json()

      if (costsData.error) {
        setError(costsData.error)
      }

      setCostAnalytics(costsData)
      setOverviewAnalytics(overviewData)
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
      setError("Failed to load analytics data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container mx-auto py-8">Loading analytics...</div>
  }

  if (!costAnalytics || !overviewAnalytics) {
    return <div className="container mx-auto py-8">Failed to load analytics</div>
  }

  const totalAICost = (costAnalytics.totals || []).reduce((sum, t) => sum + Number.parseFloat(t.total_cost || "0"), 0)
  const totalTokens = (costAnalytics.totals || []).reduce((sum, t) => sum + (t.total_tokens || 0), 0)
  const totalGenerations = (costAnalytics.totals || []).reduce((sum, t) => sum + (t.total_generations || 0), 0)
  const totalCost = totalAICost + overviewAnalytics.searches.totalCost

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Complete overview of your platform usage and costs</p>
      </div>

      {error && error.includes("does not exist") && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Setup Required</AlertTitle>
          <AlertDescription>
            Some tables haven't been created yet. Please run the SQL scripts:
            <ul className="list-disc list-inside mt-2">
              <li>
                <code className="text-sm">scripts/106_create_user_profile_table.sql</code>
              </li>
              <li>
                <code className="text-sm">scripts/107_create_ai_usage_tracking_table.sql</code>
              </li>
              <li>
                <code className="text-sm">scripts/108_add_edit_tracking_to_contacts.sql</code>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Platform Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewAnalytics.companies.total}</div>
              <p className="text-xs text-muted-foreground">{overviewAnalytics.companies.verified} verified</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewAnalytics.searches.total}</div>
              <p className="text-xs text-muted-foreground">${overviewAnalytics.searches.totalCost.toFixed(2)} spent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewAnalytics.campaigns.total}</div>
              <p className="text-xs text-muted-foreground">{overviewAnalytics.campaigns.active} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewAnalytics.contacts.total}</div>
              <p className="text-xs text-muted-foreground">{overviewAnalytics.contacts.sent} emails sent</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Email Performance</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewAnalytics.contacts.sent}</div>
              <p className="text-xs text-muted-foreground">Total emails delivered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Replies Received</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewAnalytics.contacts.replied}</div>
              <p className="text-xs text-muted-foreground">Responses from contacts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewAnalytics.contacts.replyRate}%</div>
              <p className="text-xs text-muted-foreground">Engagement rate</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Cost Overview</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground">All platform costs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Generation Cost</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalAICost.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground">{totalGenerations} generations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Search Cost</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${overviewAnalytics.searches.totalCost.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground">{overviewAnalytics.searches.total} searches</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">AI tokens used</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {costAnalytics.totals && costAnalytics.totals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Costs by Model</CardTitle>
            <CardDescription>Breakdown of costs by AI model used</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Generations</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costAnalytics.totals.map((total, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="outline">{total.model}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{total.total_generations}</TableCell>
                    <TableCell className="text-right">{total.total_tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number.parseFloat(total.total_cost).toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {costAnalytics.byCampaign && costAnalytics.byCampaign.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Costs by Campaign</CardTitle>
            <CardDescription>AI generation costs per campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Generations</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costAnalytics.byCampaign.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-right">{campaign.generation_count || 0}</TableCell>
                    <TableCell className="text-right">{(campaign.total_tokens || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number.parseFloat(campaign.total_cost || "0").toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {costAnalytics.recentUsage && costAnalytics.recentUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Generations</CardTitle>
            <CardDescription>Latest AI email generations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costAnalytics.recentUsage.map((usage) => (
                  <TableRow key={usage.id}>
                    <TableCell className="text-sm">
                      {new Date(usage.created_at).toLocaleDateString()}{" "}
                      {new Date(usage.created_at).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>{usage.campaign_name}</TableCell>
                    <TableCell>
                      {usage.first_name} {usage.last_name}
                      <div className="text-xs text-muted-foreground">{usage.contact_email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{usage.generation_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{usage.model}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{usage.total_tokens}</TableCell>
                    <TableCell className="text-right">${Number.parseFloat(usage.cost_usd).toFixed(6)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {costAnalytics.dailyCosts && costAnalytics.dailyCosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Daily Costs (Last 30 Days)
            </CardTitle>
            <CardDescription>AI generation costs over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {costAnalytics.dailyCosts.map((day) => (
                <div key={day.date} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{new Date(day.date).toLocaleDateString()}</span>
                    <Badge variant="outline">{day.generations} generations</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{day.tokens.toLocaleString()} tokens</span>
                    <span className="text-sm font-medium">${Number.parseFloat(day.cost).toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!error && costAnalytics.totals?.length === 0 && costAnalytics.recentUsage?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No data yet. Start using the platform to see analytics here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
