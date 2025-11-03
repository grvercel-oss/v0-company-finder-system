import { sql } from "@/lib/db"

export type EmailProvider = "outlook" | "zoho" | "gmail"

export interface OutlookSettings {
  email: string
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface ZohoSettings {
  email: string
  access_token: string
  refresh_token: string
  token_expires_at: Date
  data_center: string
  zoho_account_id: string // Added Zoho account ID field
  account_name?: string
  is_active?: boolean
}

export interface GmailSettings {
  email: string
  access_token: string
  refresh_token: string
  expires_at: number
}

export type ProviderSettings = OutlookSettings | ZohoSettings | GmailSettings

export interface EmailProviderConfig {
  account_id: string
  provider: EmailProvider
  settings: ProviderSettings
  connected_at: Date
  updated_at: Date
}

/**
 * Get the email provider configuration for an account
 */
export async function getEmailProvider(accountId: string): Promise<EmailProviderConfig | null> {
  const result = await sql`
    SELECT account_id, provider, settings, connected_at, updated_at
    FROM account_email_provider
    WHERE account_id = ${accountId}
    LIMIT 1
  `

  if (result.length === 0) {
    return null
  }

  return result[0] as EmailProviderConfig
}

/**
 * Save or update email provider configuration
 */
export async function saveEmailProvider(
  accountId: string,
  provider: EmailProvider,
  settings: ProviderSettings,
): Promise<void> {
  await sql`
    INSERT INTO account_email_provider (account_id, provider, settings, connected_at, updated_at)
    VALUES (${accountId}, ${provider}, ${JSON.stringify(settings)}, NOW(), NOW())
    ON CONFLICT (account_id) 
    DO UPDATE SET 
      provider = EXCLUDED.provider,
      settings = EXCLUDED.settings,
      updated_at = NOW()
  `
}

/**
 * Delete email provider configuration
 */
export async function deleteEmailProvider(accountId: string): Promise<void> {
  await sql`
    DELETE FROM account_email_provider
    WHERE account_id = ${accountId}
  `
}

/**
 * Check if a provider is connected for an account
 */
export async function isProviderConnected(accountId: string, provider?: EmailProvider): Promise<boolean> {
  const config = await getEmailProvider(accountId)

  if (!config) {
    return false
  }

  if (provider) {
    return config.provider === provider
  }

  return true
}
