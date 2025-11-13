// Groq Built-in Web Search
// Uses Groq's native web search capabilities with compound models

import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.API_KEY_GROQ_API_KEY })

export interface NewsArticle {
  title: string
  url: string
  publishedDate: string
  source: string
  category?: string
}

export interface EmployeeData {
  total: number
  growth_6mo: number
  growth_yoy: number
  timeline: Array<{
    date: string
    count: number
  }>
  by_location: Array<{ location: string; percentage: number; count: number }>
  by_department: Array<{ department: string; percentage: number; count: number }>
  by_seniority: Array<{ level: string; percentage: number; count: number }>
}

export interface CompanyResearchData {
  companyName: string
  summary: string
  employees?: EmployeeData | null
  news_articles: NewsArticle[]
  ownership: string
  founded: string
  est_revenue: string
  categories: Array<{
    category: string
    content: string
    sources: string[]
  }>
  generatedAt: string
  funding?: {
    companyName: string
    funding_rounds: Array<{
      round_type: string
      amount_usd: number
      currency: string
      announced_date: string
      lead_investors: string[]
      other_investors: string[]
      post_money_valuation?: number
      source_url: string
      confidence_score: number
    }>
    total_funding: number
    latest_valuation?: number
    financial_metrics: Array<{
      fiscal_year: number
      fiscal_quarter?: number
      revenue?: number
      profit?: number
      revenue_growth_pct?: number
      user_count?: number
      arr?: number
      mrr?: number
      source: string
      source_url: string
      confidence_score: number
    }>
    all_investors: string[]
    generatedAt: string
  } | null
}

function ultraClean(text: string): string {
  if (!text || typeof text !== "string") return ""

  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code === 32 || code === 10 || (code >= 33 && code <= 126)) {
        return char
      }
      return " "
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Research company using Groq's BUILT-IN web search tool
 * Uses groq/compound model which has native web search capabilities
 */
export async function researchCompanyWithGroq(companyName: string): Promise<CompanyResearchData> {
  console.log("[v0] [Groq Web Search] Starting research with built-in web search for:", companyName)

  try {
    const completion = await groq.chat.completions.create({
      model: "groq/compound",
      messages: [
        {
          role: "user",
          content: `Search web for "${companyName}" company. Return JSON with: news (title, url, date, source), employees (total, growth, timeline), funding (rounds, amounts, investors, URLs), ownership, founded year, revenue. Use real URLs from web search. JSON only.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 6000, // Reduced from 7500
    })

    const content = completion.choices[0]?.message?.content || "{}"
    console.log("[v0] [Groq] Received web search response")

    const executedTools = (completion.choices[0]?.message as any)?.executed_tools
    if (executedTools && executedTools.length > 0) {
      console.log(`[v0] [Groq] Web search performed, ${executedTools[0]?.search_results?.length || 0} sources found`)
    }

    const cleanedContent = ultraClean(content)
      .replace(/```(?:json)?\s*\n?/g, "")
      .replace(/\n?```/g, "")

    let analysis: any
    try {
      analysis = JSON.parse(cleanedContent)
    } catch (parseError) {
      console.log("[v0] [Groq] Failed to parse, returning empty structure")
      return {
        companyName: ultraClean(companyName),
        summary: "No verified information available",
        ownership: "n/a",
        founded: "n/a",
        est_revenue: "n/a",
        news_articles: [],
        categories: [],
        generatedAt: new Date().toISOString(),
      }
    }

    const result: CompanyResearchData = {
      companyName: ultraClean(companyName),
      summary: ultraClean(analysis.summary || `Research for ${companyName}`),
      ownership: ultraClean(analysis.ownership || "n/a"),
      founded: ultraClean(analysis.founded || "n/a"),
      est_revenue: ultraClean(analysis.est_revenue || "n/a"),
      news_articles: (analysis.news_articles || []).map((article: any) => ({
        title: ultraClean(article.title || ""),
        url: ultraClean(article.url || ""),
        publishedDate: ultraClean(article.publishedDate || ""),
        source: ultraClean(article.source || ""),
        category: ultraClean(article.category || ""),
      })),
      categories: (analysis.categories || []).map((cat: any) => ({
        category: ultraClean(cat.category || "Information"),
        content: ultraClean(cat.content || ""),
        sources: (cat.sources || []).map((s: string) => ultraClean(s)),
      })),
      generatedAt: new Date().toISOString(),
    }

    if (analysis.employees) {
      result.employees = {
        total: Number(analysis.employees.total) || 0,
        growth_6mo: Number(analysis.employees.growth_6mo) || 0,
        growth_yoy: Number(analysis.employees.growth_yoy) || 0,
        timeline: (analysis.employees.timeline || []).map((point: any) => ({
          date: ultraClean(point.date || ""),
          count: Number(point.count) || 0,
        })),
        by_location: (analysis.employees.by_location || []).map((loc: any) => ({
          location: ultraClean(loc.location || ""),
          percentage: Number(loc.percentage) || 0,
          count: Number(loc.count) || 0,
        })),
        by_department: (analysis.employees.by_department || []).map((dept: any) => ({
          department: ultraClean(dept.department || ""),
          percentage: Number(dept.percentage) || 0,
          count: Number(dept.count) || 0,
        })),
        by_seniority: (analysis.employees.by_seniority || []).map((sen: any) => ({
          level: ultraClean(sen.level || ""),
          percentage: Number(sen.percentage) || 0,
          count: Number(sen.count) || 0,
        })),
      }
    }

    if (analysis.funding_data) {
      result.funding = {
        companyName: ultraClean(companyName),
        funding_rounds: (analysis.funding_data.funding_rounds || []).map((round: any) => ({
          round_type: ultraClean(round.round_type || "Unknown"),
          amount_usd: Number(round.amount_usd) || 0,
          currency: "USD",
          announced_date: ultraClean(round.announced_date || ""),
          lead_investors: (round.lead_investors || []).map((inv: string) => ultraClean(inv)),
          other_investors: (round.other_investors || []).map((inv: string) => ultraClean(inv)),
          post_money_valuation: round.post_money_valuation ? Number(round.post_money_valuation) : undefined,
          source_url: ultraClean(round.source_url || ""),
          confidence_score: Number(round.confidence_score) || 0.8,
        })),
        total_funding: Number(analysis.funding_data.total_funding) || 0,
        latest_valuation: analysis.funding_data.latest_valuation
          ? Number(analysis.funding_data.latest_valuation)
          : undefined,
        financial_metrics: (analysis.funding_data.financial_metrics || []).map((metric: any) => ({
          fiscal_year: Number(metric.fiscal_year) || new Date().getFullYear(),
          fiscal_quarter: metric.fiscal_quarter ? Number(metric.fiscal_quarter) : undefined,
          revenue: metric.revenue ? Number(metric.revenue) : undefined,
          profit: metric.profit ? Number(metric.profit) : undefined,
          revenue_growth_pct: metric.revenue_growth_pct ? Number(metric.revenue_growth_pct) : undefined,
          user_count: metric.user_count ? Number(metric.user_count) : undefined,
          arr: metric.arr ? Number(metric.arr) : undefined,
          mrr: metric.mrr ? Number(metric.mrr) : undefined,
          source: ultraClean(metric.source || "Web Search"),
          source_url: ultraClean(metric.source_url || ""),
          confidence_score: Number(metric.confidence_score) || 0.7,
        })),
        all_investors: (analysis.funding_data.investors || []).map((inv: string) => ultraClean(inv)),
        generatedAt: new Date().toISOString(),
      }
    }

    console.log("[v0] [Groq] Research completed with web search")
    return result
  } catch (error) {
    console.error("[v0] [Groq Web Search] Error:", error)

    return {
      companyName: ultraClean(companyName),
      summary: ultraClean(`Error researching ${companyName}: ${error instanceof Error ? error.message : "Unknown"}`),
      ownership: "n/a",
      founded: "n/a",
      est_revenue: "n/a",
      news_articles: [],
      categories: [],
      generatedAt: new Date().toISOString(),
    }
  }
}
