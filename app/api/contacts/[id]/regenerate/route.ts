import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// POST regenerate email for a contact
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const contactId = Number.parseInt(params.id)

    // Get contact and campaign details
    const contacts = await sql`SELECT * FROM contacts WHERE id = ${contactId}`
    if (contacts.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const contact = contacts[0]

    const campaigns = await sql`SELECT * FROM campaigns WHERE id = ${contact.campaign_id}`
    if (campaigns.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const campaign = campaigns[0]

    // Get user profile for personalization
    const profiles = await sql`SELECT * FROM user_profile LIMIT 1`
    const profile = profiles.length > 0 ? profiles[0] : null

    // Generate new email using AI (will be implemented in next task with GPT-4o-mini)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Fixed model name from gpt-4o-nano to gpt-4o-mini
        messages: [
          {
            role: "system",
            content: `You are an expert outreach copywriter and email deliverability specialist. Generate professional, friendly, and highly effective emails for outreach. Follow these rules exactly:
- Always optimize emails to minimize chances of landing in spam folders. Avoid spammy words like 'free', 'urgent', '$$$', 'buy now'.
- Do not use long em-dashes or unnecessary punctuation. Use simple dashes or commas instead.
- Keep the tone professional, friendly, and straightforward but engaging and confident.
- Email body should be concise, clear, and easy to read. Use short paragraphs and bullets where useful.
- Include at least one clear Call-to-Action (CTA) in each email.
- Avoid overly salesy or pushy language. Focus on building trust and value.
- End the email politely.
- Provide subject lines that are clear, relevant, and personalized.
- Always format output as JSON with the following fields: { "subject": string, "body": string, "cta": string }`,
          },
          {
            role: "user",
            content: `Generate a personalized outreach email for:

Campaign: ${campaign.name}
Campaign Description: ${campaign.description || "General outreach"}

Contact Details:
- Name: ${contact.first_name} ${contact.last_name}
- Company: ${contact.company_name}
- Job Title: ${contact.job_title}
- Email: ${contact.email}

${
  profile
    ? `Sender Information:
- Name: ${profile.full_name}
- Company: ${profile.company}
- Phone: ${profile.phone}
- Website: ${profile.website}
- Email: ${profile.email}`
    : ""
}

Generate a subject line and email body. Keep it professional, concise (under 150 words), and personalized.

Return ONLY a JSON object with this exact format:
{
  "subject": "your subject line here",
  "body": "your email body here",
  "cta": "your call to action here"
}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    })

    if (!response.ok) {
      throw new Error("AI generation failed")
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse JSON response
    let emailData
    try {
      emailData = JSON.parse(content)
    } catch {
      const subjectMatch = content.match(/"subject":\s*"([^"]+)"/)
      const bodyMatch = content.match(/"body":\s*"([^"]+)"/)
      emailData = {
        subject: subjectMatch ? subjectMatch[1] : "Outreach from " + campaign.name,
        body: bodyMatch ? bodyMatch[1] : content,
      }
    }

    let finalBody = emailData.body

    if (profile) {
      // Add signature if exists
      if (profile.signature) {
        finalBody += `\n\n${profile.signature}`
      } else {
        // Create default signature from profile
        finalBody += `\n\nBest regards,\n${profile.full_name || ""}`
        if (profile.company) finalBody += `\n${profile.company}`
      }

      // Add contact information
      const contactInfo = []
      if (profile.phone) contactInfo.push(`Phone: ${profile.phone}`)
      if (profile.email) contactInfo.push(`Email: ${profile.email}`)
      if (profile.website) contactInfo.push(`Website: ${profile.website}`)
      if (profile.linkedin_url) contactInfo.push(`LinkedIn: ${profile.linkedin_url}`)

      if (contactInfo.length > 0) {
        finalBody += `\n\n${contactInfo.join(" | ")}`
      }
    }

    // Track AI usage
    const usage = data.usage
    const inputCost = (usage.prompt_tokens / 1000000) * 0.15
    const outputCost = (usage.completion_tokens / 1000000) * 0.6
    const totalCost = (inputCost + outputCost).toFixed(6)

    await sql`
      INSERT INTO ai_usage_tracking (
        campaign_id, contact_id, model, 
        prompt_tokens, completion_tokens, total_tokens,
        cost_usd, generation_type
      )
      VALUES (
        ${contact.campaign_id}, ${contactId}, 'gpt-4o-mini',
        ${usage.prompt_tokens}, ${usage.completion_tokens}, ${usage.total_tokens},
        ${totalCost}, 'regenerate'
      )
    `

    const result = await sql`
      UPDATE contacts
      SET 
        subject = ${emailData.subject},
        body = ${finalBody},
        generation_count = generation_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${contactId}
      RETURNING *
    `

    return NextResponse.json({ contact: result[0], cost: totalCost })
  } catch (error) {
    console.error("[v0] Error regenerating email:", error)
    return NextResponse.json({ error: "Failed to regenerate email" }, { status: 500 })
  }
}
