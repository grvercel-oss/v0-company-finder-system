export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all environment variables
    const envVars = {
      // Snowflake
      SNOWFLAKE_ACCOUNT: process.env.SNOWFLAKE_ACCOUNT || '',
      SNOWFLAKE_USERNAME: process.env.SNOWFLAKE_USERNAME || '',
      SNOWFLAKE_PASSWORD: process.env.SNOWFLAKE_PASSWORD || '',
      SNOWFLAKE_DATABASE: process.env.SNOWFLAKE_DATABASE || '',
      SNOWFLAKE_SCHEMA: process.env.SNOWFLAKE_SCHEMA || '',
      SNOWFLAKE_WAREHOUSE: process.env.SNOWFLAKE_WAREHOUSE || '',
      SNOWFLAKE_ROLE: process.env.SNOWFLAKE_ROLE || '',
      SNOWFLAKE_TABLE: process.env.SNOWFLAKE_TABLE || '',
      
      // Neon Database
      NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || '',
      NEON_POSTGRES_URL: process.env.NEON_POSTGRES_URL || '',
      NEON_PROJECT_ID: process.env.NEON_PROJECT_ID || '',
      
      // API Keys
      GROQ_API_KEY: process.env.GROQ_API_KEY || '',
      API_KEY_GROQ_API_KEY: process.env.API_KEY_GROQ_API_KEY || '',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
      TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
      BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
      HUNTER_API_KEY: process.env.HUNTER_API_KEY || '',
      APOLLO_API_KEY: process.env.APOLLO_API_KEY || '',
      NEWS_API_KEY: process.env.NEWS_API_KEY || '',
      
      // Clerk Auth
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
      CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET || '',
      
      // Email
      GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID || '',
      GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET || '',
      OUTLOOK_CLIENT_ID: process.env.OUTLOOK_CLIENT_ID || '',
      OUTLOOK_CLIENT_SECRET: process.env.OUTLOOK_CLIENT_SECRET || '',
      OUTLOOK_TENANT_ID: process.env.OUTLOOK_TENANT_ID || '',
      
      // Zoho
      ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID || '',
      ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET || '',
      ZOHO_DATACENTER: process.env.ZOHO_DATACENTER || '',
      
      // Upstash
      UPSTASH_KV_KV_URL: process.env.UPSTASH_KV_KV_URL || '',
      UPSTASH_KV_KV_REST_API_TOKEN: process.env.UPSTASH_KV_KV_REST_API_TOKEN || '',
      UPSTASH_KV_KV_REST_API_URL: process.env.UPSTASH_KV_KV_REST_API_URL || '',
      UPSTASH_KV_REDIS_URL: process.env.UPSTASH_KV_REDIS_URL || '',
      
      // QStash
      QSTASH_TOKEN: process.env.QSTASH_TOKEN || '',
      QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
      QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      QSTASH_URL: process.env.QSTASH_URL || '',
      
      // Other
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
      CRON_SECRET: process.env.CRON_SECRET || '',
    };

    return Response.json({ success: true, envVars });
  } catch (error) {
    console.error('[v0] Error fetching env vars:', error);
    return Response.json({ success: false, error: 'Failed to fetch environment variables' }, { status: 500 });
  }
}
