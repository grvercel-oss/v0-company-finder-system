import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateText } from "ai"
import { trackAIUsage } from "@/lib/ai-cost-tracker"
import { auth } from "@clerk/nextjs/server"

// POST regenerate email for a contact
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const { text, usage } = await generateText({
      model: "groq/openai/gpt-oss-20b",
      temperature: 0.7,
      maxTokens: 500,
      system: `# ROLE: ELITE CONVERSATIONALIST

You are an Elite Conversationalist specializing in highly effective, customized cold email outreach. Your sole purpose is to generate a single, complete email (Subject Line and Body) that appears to be written manually by a knowledgeable, busy human colleague or executive.

Your generated email must be immediately usable for outbound communication. The tone must be concise, direct, professional, and entirely authentic.

# CRITICAL ANTI-AI OUTPUT CONSTRAINTS

NEVER violate these rules. The goal is 100% human authenticity.

1. **Avoid AI Markers:** Do not use long dashes (— or em-dashes), excessive bullet points within the main email prose, unnecessary markdown formatting, or any introductory filler phrases like "I hope this email finds you well," "I am reaching out to," "Certainly," "Absolutely," or "Based on my analysis."
2. **Brevity and Focus:** Keep all sentences short and the email body maximally concise, prioritizing signal over noise. The subject line must be compelling yet brief (ideally under seven words).
3. **No Templates:** The output must be the finished, custom email text, not a template with placeholders or instructional commentary.
4. **Natural Flow:** Write as a busy professional would - direct, confident, and conversational without being overly formal or robotic.
5. **NO SIGNATURE:** Do NOT include any closing signature, sign-off, "Best regards", "Sincerely", name, title, or contact information. The email body should end with the call-to-action or final thought. Signatures are added automatically.

# PERSUASION STRATEGY (INTERNAL - DO NOT REFERENCE)

You must internally apply these principles without mentioning them:

**Relationship Cultivation:**
- Reciprocity: Offer value before asking
- Liking: Find common ground or genuine compliment

**Reducing Uncertainty:**
- Social Proof: Reference similar companies/people
- Authority: Demonstrate deep knowledge of their problem

**Motivating Action:**
- Scarcity: Create urgency naturally
- Commitment: Make the ask as small as possible

# SUBJECT LINE STRATEGY

Your subject line must:
- Trigger System 2 (slow, analytical thinking)
- Avoid spam triggers and marketing clichés
- Use curiosity gaps, relevant questions, or non sequiturs
- Stay under 7 words
- Never be deceptive or create expectation gaps

# OUTPUT FORMAT

Return ONLY a JSON object with this exact format:
{
  "subject": "your subject line here",
  "body": "your email body here"
}

The body should be 50-120 words maximum. Include a greeting (Hi [FirstName],) but NO signature, sign-off, or closing whatsoever.`,
      prompt: `Generate a personalized outreach email using this context:

**Campaign Context:**
${campaign.name}${campaign.description ? ` - ${campaign.description}` : ""}

**Recipient:**
${contact.first_name} ${contact.last_name}
${contact.job_title || ""}${contact.company_name ? ` at ${contact.company_name}` : ""}
Email: ${contact.email}

**Sender:**
${profile?.full_name || "Our team"}${profile?.company ? ` from ${profile.company}` : ""}

**Your Task:**
Create a concise, human-written cold email that:
1. Opens with a relevant observation or compliment about their company/role (if possible)
2. Quickly states why you're reaching out and the value proposition
3. Includes subtle social proof or authority if relevant to campaign
4. Ends with the smallest possible commitment ask (e.g., "Worth a quick chat?")

Remember: 
- Sound like a busy human, not an AI
- Be direct, confident, and conversational
- Include greeting but NO signature or sign-off
- End with the call-to-action`,
    })

    // Parse JSON response
    let emailData
    try {
      emailData = JSON.parse(text)
    } catch {
      const subjectMatch = text.match(/"subject":\s*"([^"]+)"/)
      const bodyMatch = text.match(/"body":\s*"([^"]+)"/)
      emailData = {
        subject: subjectMatch ? subjectMatch[1] : `Re: ${campaign.name}`,
        body: bodyMatch ? bodyMatch[1] : text,
      }
    }

    let finalBody = emailData.body

    // Append user's custom signature if it exists
    if (profile?.signature) {
      finalBody += `\n\n${profile.signature}`
    }

    const cost = await trackAIUsage({
      sql,
      accountId: userId,
      model: "groq/openai/gpt-oss-20b",
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      generationType: "regenerate",
      campaignId: contact.campaign_id,
      contactId,
    })

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

    return NextResponse.json({ contact: result[0], cost: cost.toFixed(6) })
  } catch (error) {
    console.error("Error regenerating email:", error)
    return NextResponse.json({ error: "Failed to regenerate email" }, { status: 500 })
  }
}
