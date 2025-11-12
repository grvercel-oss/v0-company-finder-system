// Centralized AI Cost Tracking System
// Tracks all AI usage across the application with exact pricing

export const AI_MODELS = {
  // Groq Models
  "llama-3.3-70b-versatile": {
    provider: "Groq",
    inputCostPer1M: 0.59,
    outputCostPer1M: 0.79,
  },
  "groq/openai/gpt-oss-20b": {
    provider: "Groq",
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.5,
  },
  "perplexity/sonar": {
    provider: "Perplexity",
    inputCostPer1M: 1.0,
    outputCostPer1M: 1.0,
  },
  "gpt-4o-mini": {
    provider: "OpenAI",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
  },
  tavily: {
    provider: "Tavily",
    inputCostPer1M: 2000, // $0.002 per search, assuming ~1000 searches per "1M tokens equivalent"
    outputCostPer1M: 0,
  },
} as const

export type AIModel = keyof typeof AI_MODELS

/**
 * Calculate cost for AI usage
 */
export function calculateAICost(model: AIModel, promptTokens: number, completionTokens: number): number {
  const modelConfig = AI_MODELS[model]
  if (!modelConfig) {
    console.error(`[AI Cost Tracker] Unknown model: ${model}`)
    return 0
  }

  const inputCost = (promptTokens / 1_000_000) * modelConfig.inputCostPer1M
  const outputCost = (completionTokens / 1_000_000) * modelConfig.outputCostPer1M

  return inputCost + outputCost
}

/**
 * Track AI usage in database
 */
export async function trackAIUsage(params: {
  sql: any
  accountId: string
  model: AIModel
  promptTokens: number
  completionTokens: number
  generationType: string
  campaignId?: number
  contactId?: number
}) {
  const { sql, accountId, model, promptTokens, completionTokens, generationType, campaignId, contactId } = params

  const cost = calculateAICost(model, promptTokens, completionTokens)

  await sql`
    INSERT INTO ai_usage_tracking (
      account_id, campaign_id, contact_id, model,
      prompt_tokens, completion_tokens, total_tokens,
      cost_usd, generation_type
    )
    VALUES (
      ${accountId},
      ${campaignId || null},
      ${contactId || null},
      ${model},
      ${promptTokens},
      ${completionTokens},
      ${promptTokens + completionTokens},
      ${cost},
      ${generationType}
    )
  `

  return cost
}

/**
 * Track Tavily search usage (cost per search)
 */
export async function trackTavilyUsage(params: {
  sql: any
  accountId: string
  searchCount: number
  generationType: string
}) {
  const { sql, accountId, searchCount, generationType } = params

  const costPerSearch = 0.002
  const cost = searchCount * costPerSearch

  await sql`
    INSERT INTO ai_usage_tracking (
      account_id, model,
      prompt_tokens, completion_tokens, total_tokens,
      cost_usd, generation_type
    )
    VALUES (
      ${accountId},
      'tavily',
      ${searchCount * 1000},
      0,
      ${searchCount * 1000},
      ${cost},
      ${generationType}
    )
  `

  return cost
}
