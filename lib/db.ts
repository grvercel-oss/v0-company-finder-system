import { neon } from "@neondatabase/serverless"

let sqlInstance: ReturnType<typeof neon> | null = null

function getSQL() {
  // Skip database initialization during build time
  if (typeof window === "undefined" && process.env.NEXT_PHASE === "phase-production-build") {
    throw new Error("Database access not available during build")
  }

  if (!sqlInstance) {
    const dbUrl = process.env.NEON_NEON_DATABASE_URL
    if (!dbUrl) {
      throw new Error("NEON_DATABASE_URL environment variable is not set")
    }
    sqlInstance = neon(dbUrl)
  }
  return sqlInstance
}

export function sql(...args: Parameters<ReturnType<typeof neon>>) {
  return getSQL()(...args)
}

// Types for our database models
export interface Company {
  id: number
  name: string
  domain?: string
  description?: string
  industry?: string
  size?: string
  location?: string
  founded_year?: number
  website?: string
  linkedin_url?: string
  twitter_url?: string
  employee_count?: string
  revenue_range?: string
  funding_stage?: string
  total_funding?: string
  technologies?: string[]
  keywords?: string[]
  logo_url?: string
  raw_data?: any
  ai_summary?: string
  last_updated: Date
  created_at: Date
  data_quality_score: number
  verified: boolean
  investors?: Investor[] // Added investors array
}

export interface SearchHistory {
  id: number
  query: string
  filters?: any
  results_count?: number
  search_timestamp: Date
}

export interface CompanyUpdate {
  id: number
  company_id: number
  update_type: string
  changes?: any
  updated_at: Date
}

export interface CompanyContact {
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
  email_verification_status?: "pending" | "verified" | "unverified" | "invalid"
  created_at: Date
}

export interface Investor {
  id: number
  company_id: number
  investor_name: string
  investor_type?: string // 'VC', 'Angel', 'Corporate', 'PE', etc.
  investor_website?: string
  investment_amount?: string
  investment_round?: string
  investment_date?: Date
  investment_year?: number
  source?: string
  confidence_score: number
  created_at: Date
  updated_at: Date
}
