"use client"

import { TrendingUp, DollarSign, Users, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"

interface FundingRound {
  round_type: string
  amount_usd: number
  announced_date: string
  lead_investors: string[]
  other_investors: string[]
  post_money_valuation?: number
}

interface FinancialMetrics {
  fiscal_year: number
  revenue?: number
  profit?: number
  revenue_growth_pct?: number
  user_count?: number
}

interface FundingChartsProps {
  fundingRounds: FundingRound[]
  financialMetrics: FinancialMetrics[]
  totalFunding: number
  latestValuation?: number
  allInvestors: string[]
}

export function FundingCharts({
  fundingRounds,
  financialMetrics,
  totalFunding,
  latestValuation,
  allInvestors,
}: FundingChartsProps) {
  // Prepare funding timeline data
  const safeFundingRounds = Array.isArray(fundingRounds) ? fundingRounds : []
  const safeFinancialMetrics = Array.isArray(financialMetrics) ? financialMetrics : []
  const safeInvestors = Array.isArray(allInvestors) ? allInvestors : []
  const safeTotalFunding = typeof totalFunding === "number" && !isNaN(totalFunding) ? totalFunding : 0

  const fundingTimelineData = safeFundingRounds
    .filter((round) => round && typeof round.amount_usd === "number" && round.announced_date)
    .sort((a, b) => new Date(a.announced_date).getTime() - new Date(b.announced_date).getTime())
    .map((round) => ({
      date: new Date(round.announced_date).toLocaleDateString("en-US", { year: "numeric", month: "short" }),
      amount: round.amount_usd / 1000000,
      roundType: round.round_type || "Unknown",
      valuation: round.post_money_valuation ? round.post_money_valuation / 1000000 : undefined,
    }))

  const revenueData = safeFinancialMetrics
    .filter((m) => m && m.revenue && typeof m.fiscal_year === "number")
    .sort((a, b) => a.fiscal_year - b.fiscal_year)
    .map((metric) => ({
      year: metric.fiscal_year.toString(),
      revenue: metric.revenue! / 1000000,
      profit: metric.profit ? metric.profit / 1000000 : 0,
      growth: metric.revenue_growth_pct || 0,
    }))

  const formatCurrency = (value: number) => {
    if (!isFinite(value)) return "$0M"
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`
    return `$${value.toFixed(1)}M`
  }

  if (safeFundingRounds.length === 0 && safeFinancialMetrics.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No funding or financial data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {safeTotalFunding > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Funding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(safeTotalFunding / 1000000)}</div>
              <p className="text-xs text-muted-foreground mt-1">{safeFundingRounds.length} rounds</p>
            </CardContent>
          </Card>
        )}

        {latestValuation && typeof latestValuation === "number" && latestValuation > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Valuation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(latestValuation / 1000000)}</div>
              <p className="text-xs text-muted-foreground mt-1">Latest round</p>
            </CardContent>
          </Card>
        )}

        {safeInvestors.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Investors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{safeInvestors.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique investors</p>
            </CardContent>
          </Card>
        )}

        {safeFundingRounds.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Latest Round
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  safeFundingRounds.sort(
                    (a, b) => new Date(b.announced_date).getTime() - new Date(a.announced_date).getTime(),
                  )[0].round_type
                }
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(
                  safeFundingRounds.sort(
                    (a, b) => new Date(b.announced_date).getTime() - new Date(a.announced_date).getTime(),
                  )[0].announced_date,
                ).getFullYear()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Funding Timeline Chart */}
      {fundingTimelineData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Funding Timeline</CardTitle>
            <CardDescription>Funding rounds over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                amount: {
                  label: "Funding Amount",
                  color: "hsl(var(--chart-1))",
                },
                valuation: {
                  label: "Valuation",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundingTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value, payload) => {
                          const item = payload[0]?.payload
                          return item ? `${item.roundType} - ${value}` : value
                        }}
                        formatter={(value) => `$${value}M`}
                      />
                    }
                  />
                  <Legend />
                  <Bar dataKey="amount" fill="var(--color-amount)" name="Funding Amount ($M)" radius={[8, 8, 0, 0]} />
                  {fundingTimelineData.some((d) => d.valuation) && (
                    <Bar
                      dataKey="valuation"
                      fill="var(--color-valuation)"
                      name="Valuation ($M)"
                      radius={[8, 8, 0, 0]}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Revenue Chart */}
      {revenueData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Performance</CardTitle>
            <CardDescription>Revenue and profit trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: {
                  label: "Revenue",
                  color: "hsl(var(--chart-3))",
                },
                profit: {
                  label: "Profit",
                  color: "hsl(var(--chart-4))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => `$${value}M`} />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    name="Revenue ($M)"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="var(--color-profit)"
                    strokeWidth={2}
                    name="Profit ($M)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Investor List */}
      {safeInvestors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Investors</CardTitle>
            <CardDescription>All participating investors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {safeInvestors.map((investor, idx) => (
                <div key={idx} className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium border">
                  {investor}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
