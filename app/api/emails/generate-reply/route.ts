import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { threadId, prompt } = body

    if (!threadId || !prompt) {
      return NextResponse.json({ error: "Thread ID and prompt are required" }, { status: 400 })
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Get thread details and messages
    const threads = await sql`
      SELECT 
        t.*,
        c.email as contact_email,
        c.first_name,
        c.last_name,
        c.company_name,
        c.job_title,
        camp.name as campaign_name,
        camp.description as campaign_description
      FROM email_threads t
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN campaigns camp ON t.campaign_id = camp.id
      WHERE t.id = ${threadId}
    `

    if (threads.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const thread = threads[0]

    // Get conversation history
    const messages = await sql`
      SELECT *
      FROM email_messages
      WHERE thread_id = ${threadId}
      ORDER BY COALESCE(sent_at, received_at, created_at) ASC
    `

    // Get user profile for signature
    const profiles = await sql`SELECT * FROM user_profile LIMIT 1`
    const profile = profiles.length > 0 ? profiles[0] : null

    // Build conversation context
    const conversationContext = messages
      .map((msg) => {
        const role = msg.direction === "sent" ? "You" : thread.first_name || "Contact"
        return `${role}: ${msg.body}`
      })
      .join("\n\n")

    // Generate reply using OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `You are a professional email assistant helping to write replies. Generate natural, professional, and contextual email replies based on the conversation history and user's instructions.

Rules:
- Keep replies concise and professional
- Match the tone of the conversation
- Be friendly but not overly casual
- Include a clear call-to-action when appropriate
- Do not include greetings like "Dear" or signatures - those will be added automatically
- Focus only on the message body content
- Be helpful and solution-oriented`,
          },
          {
            role: "user",
            content: `Generate an email reply based on this context:

Conversation with: ${thread.first_name} ${thread.last_name} from ${thread.company_name}
${thread.job_title ? `Job Title: ${thread.job_title}` : ""}
Campaign: ${thread.campaign_name}

Previous conversation:
${conversationContext}

User's instruction for the reply:
${prompt}

${
  profile
    ? `
Your information (for context, don't repeat in reply):
- Name: ${profile.full_name}
- Company: ${profile.company}
- Email: ${profile.email}
`
    : ""
}

Generate ONLY the email body content (no greeting, no signature). Keep it professional and contextual.`,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error("OpenAI API request failed")
    }

    const data = await response.json()
    let replyBody = data.choices[0].message.content.trim()

    // Add signature if available
    if (profile) {
      if (profile.signature) {
        replyBody += `\n\n${profile.signature}`
      } else {
        replyBody += `\n\nBest regards,\n${profile.full_name || ""}`
        if (profile.company) replyBody += `\n${profile.company}`
      }

      // Add contact information
      const contactInfo = []
      if (profile.phone) contactInfo.push(`Phone: ${profile.phone}`)
      if (profile.email) contactInfo.push(`Email: ${profile.email}`)
      if (profile.website) contactInfo.push(`Website: ${profile.website}`)

      if (contactInfo.length > 0) {
        replyBody += `\n\n${contactInfo.join(" | ")}`
      }
    }

    // Track AI usage
    const usage = data.usage
    const inputCost = (usage.prompt_tokens / 1000000) * 0.15
    const outputCost = (usage.completion_tokens / 1000000) * 0.6
    const totalCost = (inputCost + outputCost).toFixed(6)

    await sql`
      INSERT INTO ai_usage_tracking (
        campaign_id, model, 
        prompt_tokens, completion_tokens, total_tokens,
        cost_usd, generation_type
      )
      VALUES (
        ${thread.campaign_id}, 'gpt-4o-mini',
        ${usage.prompt_tokens}, ${usage.completion_tokens}, ${usage.total_tokens},
        ${totalCost}, 'reply'
      )
    `

    return NextResponse.json({
      reply: replyBody,
      cost: totalCost,
      tokens: usage.total_tokens,
    })
  } catch (error) {
    console.error("Error generating reply:", error)
    return NextResponse.json({ error: "Failed to generate reply", details: String(error) }, { status: 500 })
  }
}
