// Base types for search worker architecture

export interface ICP {
  industries: string[]
  locations: string[]
  company_sizes: string[]
  technologies?: string[]
  keywords?: string[]
  funding_stages?: string[]
  revenue_ranges?: string[]
  description: string
}

export interface CompanyResult {
  name: string
  domain?: string
  description?: string
  industry?: string
  location?: string
  website?: string
  employee_count?: string
  revenue_range?: string
  funding_stage?: string
  technologies?: string[]
  source: string
  confidence_score?: number
}

export interface SearchWorkerResult {
  companies: CompanyResult[]
  source: string
  duration_ms: number
  error?: string
}

export interface SearchWorker {
  name: string
  search(queries: string[], icp: ICP, desiredCount?: number): Promise<SearchWorkerResult>
  timeout: number
}
