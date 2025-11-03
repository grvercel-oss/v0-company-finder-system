import { sql } from "./db"

// Check if database tables exist and are properly set up
export async function checkDatabaseSetup(): Promise<{
  isSetup: boolean
  missingTables: string[]
  error?: string
}> {
  console.log("[v0] Checking database setup...")

  try {
    const requiredTables = [
      "companies",
      "search_history",
      "company_updates",
      "company_lists",
      "company_list_items",
      "outreach_campaigns",
      "outreach_contacts",
      "email_config", // Added email_config to required tables
    ]
    const missingTables: string[] = []

    for (const table of requiredTables) {
      try {
        const result = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${table}
          ) as exists
        `

        console.log(`[v0] Table ${table} exists:`, result[0]?.exists)

        if (!result[0]?.exists) {
          missingTables.push(table)
        }
      } catch (error: any) {
        console.error(`[v0] Error checking table ${table}:`, error.message)
        missingTables.push(table)
      }
    }

    const isSetup = missingTables.length === 0

    console.log("[v0] Database setup check complete:", { isSetup, missingTables })

    return {
      isSetup,
      missingTables,
    }
  } catch (error: any) {
    console.error("[v0] Database setup check failed:", error.message)
    return {
      isSetup: false,
      missingTables: [],
      error: error.message,
    }
  }
}

// Initialize database tables if they don't exist
export async function initializeDatabase(): Promise<{ success: boolean; error?: string }> {
  console.log("[v0] Initializing database tables...")

  try {
    // Create companies table
    await sql`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        description TEXT,
        industry VARCHAR(100),
        size VARCHAR(50),
        location VARCHAR(255),
        founded_year INTEGER,
        website VARCHAR(500),
        linkedin_url VARCHAR(500),
        twitter_url VARCHAR(500),
        employee_count VARCHAR(50),
        revenue_range VARCHAR(100),
        funding_stage VARCHAR(100),
        total_funding VARCHAR(100),
        technologies JSONB DEFAULT '[]',
        keywords JSONB DEFAULT '[]',
        logo_url VARCHAR(500),
        raw_data JSONB,
        ai_summary TEXT,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_quality_score INTEGER DEFAULT 50,
        verified BOOLEAN DEFAULT false
      )
    `
    console.log("[v0] Companies table created/verified")

    // Create indexes for companies table
    await sql`CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain)`
    await sql`CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)`
    await sql`CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry)`
    console.log("[v0] Companies indexes created/verified")

    // Create search_history table
    await sql`
      CREATE TABLE IF NOT EXISTS search_history (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        filters JSONB,
        results_count INTEGER,
        search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log("[v0] Search history table created/verified")

    await sql`
      ALTER TABLE search_history 
      ADD COLUMN IF NOT EXISTS perplexity_input_tokens INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS perplexity_output_tokens INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS perplexity_cost DECIMAL(10, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS openai_input_tokens INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS openai_output_tokens INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS openai_cost DECIMAL(10, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 6) DEFAULT 0
    `
    console.log("[v0] Cost tracking columns added/verified")

    await sql`CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(search_timestamp DESC)`
    await sql`CREATE INDEX IF NOT EXISTS idx_search_history_cost ON search_history(total_cost DESC)`

    // Create company_updates table
    await sql`
      CREATE TABLE IF NOT EXISTS company_updates (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        update_type VARCHAR(50) NOT NULL,
        changes JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log("[v0] Company updates table created/verified")

    await sql`CREATE INDEX IF NOT EXISTS idx_company_updates_company_id ON company_updates(company_id)`

    await sql`
      CREATE TABLE IF NOT EXISTS company_lists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log("[v0] Company lists table created/verified")

    await sql`CREATE INDEX IF NOT EXISTS idx_company_lists_name ON company_lists(name)`
    await sql`CREATE INDEX IF NOT EXISTS idx_company_lists_created_at ON company_lists(created_at DESC)`

    await sql`
      CREATE TABLE IF NOT EXISTS company_list_items (
        id SERIAL PRIMARY KEY,
        list_id INTEGER NOT NULL REFERENCES company_lists(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        UNIQUE(list_id, company_id)
      )
    `
    console.log("[v0] Company list items table created/verified")

    await sql`CREATE INDEX IF NOT EXISTS idx_company_list_items_list_id ON company_list_items(list_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_company_list_items_company_id ON company_list_items(company_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_company_list_items_added_at ON company_list_items(added_at DESC)`

    await sql`
      CREATE TABLE IF NOT EXISTS outreach_campaigns (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        offer_description TEXT NOT NULL,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
        total_contacts INTEGER DEFAULT 0,
        emails_sent INTEGER DEFAULT 0,
        replies_received INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log("[v0] Outreach campaigns table created/verified")

    await sql`CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON outreach_campaigns(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_created_at ON outreach_campaigns(created_at DESC)`

    await sql`
      CREATE TABLE IF NOT EXISTS outreach_contacts (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
        company_name TEXT,
        contact_name TEXT,
        email TEXT NOT NULL,
        company_info JSONB DEFAULT '{}',
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'email_generated', 'sent', 'replied', 'bounced', 'failed')), // Updated status check to include 'failed'
        email_subject TEXT,
        email_body TEXT,
        message_id TEXT,
        sent_at TIMESTAMP,
        replied_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log("[v0] Outreach contacts table created/verified")

    await sql`CREATE INDEX IF NOT EXISTS idx_outreach_contacts_campaign_id ON outreach_contacts(campaign_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_outreach_contacts_status ON outreach_contacts(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_outreach_contacts_email ON outreach_contacts(email)`

    await sql`
      CREATE TABLE IF NOT EXISTS email_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        email TEXT NOT NULL,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL,
        smtp_user TEXT NOT NULL,
        smtp_password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT single_config CHECK (id = 1)
      )
    `
    console.log("[v0] Email config table created/verified")

    await sql`CREATE INDEX IF NOT EXISTS idx_email_config_id ON email_config(id)`

    console.log("[v0] Database initialization complete")

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Database initialization failed:", error.message)
    console.error("[v0] Error details:", error)
    return { success: false, error: error.message }
  }
}
