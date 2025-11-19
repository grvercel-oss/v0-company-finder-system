// Server-side environment variable validation
export function validateEnvironmentVariables() {
  const keysToCheck = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'GEMINI_API_KEY',
    'PERPLEXITY_API_KEY',
    'OPENAI_API_KEY',
    'GROQ_API_KEY',
    'SNOWFLAKE_PASSWORD',
  ]

  const issues: string[] = []

  for (const key of keysToCheck) {
    const value = process.env[key]
    
    if (!value) continue

    // Check for non-Latin1 characters (which cause btoa to fail)
    // Latin1 is characters 0-255
    for (let i = 0; i < value.length; i++) {
      const charCode = value.charCodeAt(i)
      if (charCode > 255) {
        issues.push(`${key} contains non-Latin1 character at position ${i}: '${value[i]}' (code: ${charCode})`)
      }
    }

    // Check for common problematic characters
    if (value.includes('\u200b')) { // Zero-width space
      issues.push(`${key} contains zero-width space`)
    }
    if (value.includes('\ufeff')) { // BOM
      issues.push(`${key} contains byte order mark (BOM)`)
    }

    // Check for leading/trailing whitespace
    if (value !== value.trim()) {
      issues.push(`${key} has leading or trailing whitespace`)
    }
  }

  if (issues.length > 0) {
    console.error('[v0] [Environment Validation] Issues found:')
    issues.forEach(issue => console.error(`  - ${issue}`))
    return false
  }

  console.log('[v0] [Environment Validation] All checked variables are valid')
  return true
}
