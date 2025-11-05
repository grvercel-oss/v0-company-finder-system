// Cost calculator for GPT API usage

// gpt-5-nano pricing (per 1M tokens)
const GPT_5_NANO_INPUT_COST = 0.05 // $0.05 per 1M input tokens
const GPT_5_NANO_OUTPUT_COST = 0.4 // $0.40 per 1M output tokens

// GPT-4o pricing (per 1M tokens)
const GPT_4O_INPUT_COST = 2.5 // $2.50 per 1M input tokens
const GPT_4O_OUTPUT_COST = 10.0 // $10.00 per 1M output tokens

// GPT-4.1-mini pricing (per 1M tokens) - Standard tier
const GPT_41_MINI_INPUT_COST = 0.4 // $0.40 per 1M input tokens
const GPT_41_MINI_OUTPUT_COST = 1.6 // $1.60 per 1M output tokens

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
}

export interface CostBreakdown {
  input_cost: number
  output_cost: number
  total_cost: number
  input_tokens: number
  output_tokens: number
}

export function calculateCost(inputTokens: number, outputTokens: number): number {
  const input_cost = (inputTokens / 1_000_000) * GPT_5_NANO_INPUT_COST
  const output_cost = (outputTokens / 1_000_000) * GPT_5_NANO_OUTPUT_COST
  return input_cost + output_cost
}

export function calculateGPT4oCost(usage: TokenUsage): CostBreakdown {
  const input_cost = (usage.input_tokens / 1_000_000) * GPT_4O_INPUT_COST
  const output_cost = (usage.output_tokens / 1_000_000) * GPT_4O_OUTPUT_COST
  const total_cost = input_cost + output_cost

  return {
    input_cost,
    output_cost,
    total_cost,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  }
}

export function calculateGPT41MiniCost(usage: TokenUsage): CostBreakdown {
  const input_cost = (usage.input_tokens / 1_000_000) * GPT_41_MINI_INPUT_COST
  const output_cost = (usage.output_tokens / 1_000_000) * GPT_41_MINI_OUTPUT_COST
  const total_cost = input_cost + output_cost

  return {
    input_cost,
    output_cost,
    total_cost,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  }
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(4)}¢`
  }
  return `$${cost.toFixed(4)}`
}
