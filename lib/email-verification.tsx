import crypto from "crypto"

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function getVerificationTokenExpiry(): Date {
  // Token expires in 24 hours
  const expiry = new Date()
  expiry.setHours(expiry.getHours() + 24)
  return expiry
}

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`

  // For development: Log to console
  // In production: Replace with actual email service (Resend, SendGrid, etc.)
  console.log("\n========================================")
  console.log("📧 EMAIL VERIFICATION")
  console.log("========================================")
  console.log(`To: ${email}`)
  console.log(`Verification Link: ${verificationUrl}`)
  console.log("========================================\n")

  // TODO: Replace with actual email service
  // Example with Resend:
  // await resend.emails.send({
  //   from: 'noreply@yourdomain.com',
  //   to: email,
  //   subject: 'Verify your email address',
  //   html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`
  // })

  return verificationUrl
}

export async function sendVerificationReminderEmail(email: string, token: string) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`

  console.log("\n========================================")
  console.log("📧 EMAIL VERIFICATION REMINDER")
  console.log("========================================")
  console.log(`To: ${email}`)
  console.log(`Verification Link: ${verificationUrl}`)
  console.log("========================================\n")

  return verificationUrl
}
