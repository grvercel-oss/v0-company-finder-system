// OpenAI client for data summarization and enrichment
export interface CompanyEnrichmentResult {
  summary: string
  extractedInfo: {
    // Contact Information
    email?: string
    phone?: string
    contact_email_pattern?: string

    // Social Media & Web Presence
    linkedin_url?: string
    twitter_url?: string
    facebook_url?: string
    instagram_url?: string
    github_url?: string

    // Company Details
    technologies?: string[]
    keywords?: string[]
    employee_count?: string
    revenue_range?: string
    funding_stage?: string
    total_funding?: string
    founded_year?: number

    // Additional Info
    headquarters?: string
    ceo_name?: string
    key_people?: string[]
    recent_news?: string
    competitors?: string[]
  }
  quality_score: number
  usage?: {
    input_tokens: number
    output_tokens: number
    cost: number
  }
}

export async function enrichCompanyDataWithOpenAI(companyData: any): Promise<CompanyEnrichmentResult> {
  console.log("[v0] Starting OpenAI enrichment for company:", companyData.name)

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.error("[v0] OPENAI_API_KEY is not configured")
    throw new Error("OPENAI_API_KEY is not configured")
  }

  console.log("[v0] OpenAI API key found, length:", apiKey.length)

  const prompt = `You are a business intelligence analyst. Analyze this company and extract as much detailed information as possible.

Company Data:
${JSON.stringify(companyData, null, 2)}

Please provide a comprehensive analysis with the following information:

1. **Summary**: A professional 2-3 sentence summary of the company
2. **Contact Information**: 
   - General contact email (if publicly available)
   - Phone number (if publicly available)
   - Common email pattern (e.g., firstname.lastname@domain.com)
3. **Social Media & Web Presence**:
   - LinkedIn company page URL
   - Twitter/X handle and URL
   - Facebook page URL
   - Instagram handle (if applicable)
   - GitHub organization (if tech company)
4. **Company Details**:
   - Technologies used (programming languages, frameworks, tools)
   - Industry keywords and tags
   - Employee count or range (e.g., "50-100", "500-1000")
   - Revenue range (e.g., "$1M-$5M", "$10M-$50M")
   - Funding stage (e.g., "Seed", "Series A", "Series B", "Public")
   - Total funding amount (if available)
   - Founded year
5. **Leadership & People**:
   - CEO/Founder name
   - Other key executives or notable team members
6. **Market Position**:
   - Main competitors
   - Recent news or notable achievements
7. **Data Quality Score**: Rate the completeness of available data (0-100)

Return your response in JSON format with these exact keys:
{
  "summary": "...",
  "email": "...",
  "phone": "...",
  "contact_email_pattern": "...",
  "linkedin_url": "...",
  "twitter_url": "...",
  "facebook_url": "...",
  "instagram_url": "...",
  "github_url": "...",
  "technologies": [...],
  "keywords": [...],
  "employee_count": "...",
  "revenue_range": "...",
  "funding_stage": "...",
  "total_funding": "...",
  "founded_year": ...,
  "headquarters": "...",
  "ceo_name": "...",
  "key_people": [...],
  "recent_news": "...",
  "competitors": [...],
  "quality_score": ...
}

Only include fields where you have reliable information. Use null for unknown fields.`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a business intelligence analyst specializing in company research. Extract comprehensive, accurate information about companies including contact details, social media, funding, and market position. Only provide information you're confident about.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    })

    console.log("[v0] OpenAI API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API error response:", errorText)
      throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log("[v0] OpenAI API response received")

    const result = JSON.parse(data.choices[0].message.content)
    console.log("[v0] Enrichment complete, quality score:", result.quality_score)

    const usage = data.usage || {}
    const inputTokens = usage.prompt_tokens || 0
    const outputTokens = usage.completion_tokens || 0

    // OpenAI GPT-4o-mini pricing: $0.150 per 1M input tokens, $0.600 per 1M output tokens
    const inputCost = (inputTokens / 1_000_000) * 0.15
    const outputCost = (outputTokens / 1_000_000) * 0.6
    const totalCost = inputCost + outputCost

    console.log("[v0] OpenAI usage - Input tokens:", inputTokens, "Output tokens:", outputTokens)
    console.log("[v0] OpenAI cost: $", totalCost.toFixed(6))

    return {
      summary: result.summary || "",
      extractedInfo: {
        email: result.email,
        phone: result.phone,
        contact_email_pattern: result.contact_email_pattern,
        linkedin_url: result.linkedin_url,
        twitter_url: result.twitter_url,
        facebook_url: result.facebook_url,
        instagram_url: result.instagram_url,
        github_url: result.github_url,
        technologies: result.technologies || [],
        keywords: result.keywords || [],
        employee_count: result.employee_count,
        revenue_range: result.revenue_range,
        funding_stage: result.funding_stage,
        total_funding: result.total_funding,
        founded_year: result.founded_year,
        headquarters: result.headquarters,
        ceo_name: result.ceo_name,
        key_people: result.key_people || [],
        recent_news: result.recent_news,
        competitors: result.competitors || [],
      },
      quality_score: result.quality_score || 50,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost: totalCost,
      },
    }
  } catch (error: any) {
    console.error("[v0] OpenAI enrichment error:", error.message)
    throw error
  }
}
