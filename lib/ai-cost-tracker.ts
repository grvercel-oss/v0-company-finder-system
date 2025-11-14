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
  "llama-3.1-sonar-large-128k-online": {
    provider: "Perplexity",
    inputCostPer1M: 1.0,
    outputCostPer1M: 1.0,
  },
  "gpt-4o": {
    provider: "OpenAI",
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
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
