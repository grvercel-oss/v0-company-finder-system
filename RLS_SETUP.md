# Row Level Security (RLS) Setup Guide

This document explains how Row Level Security is implemented in the Company Finder System.

## What is RLS?

Row Level Security (RLS) is a PostgreSQL feature that restricts which rows users can access in database tables. It ensures that users can only see and modify their own data.

## How It Works

1. **Account ID Column**: All user-specific tables have an `account_id` column that identifies which user owns the data.

2. **Session Variable**: Before running queries, we set a session variable `app.current_account_id` to identify the current user.

3. **RLS Policies**: PostgreSQL automatically filters all queries to only return rows where `account_id` matches the session variable.

## Tables Protected by RLS

- `zoho_config` - OAuth tokens and Zoho configuration
- `gmail_accounts` - Gmail account connections
- `contacts` - Email contacts
- `campaigns` - Email campaigns
- `email_threads` - Email conversation threads
- `email_messages` - Individual email messages
- `replies` - Detected email replies
- `outreach_campaigns` - Outreach campaigns
- `outreach_contacts` - Outreach contacts
- `company_lists` - Custom company lists
- `company_list_items` - Items in company lists
- `user_profile` - User profile data
- `ai_usage_tracking` - AI usage and costs
- `email_events` - Email events (opens, clicks, etc.)
- `workflow_jobs` - Scheduled workflow jobs

## Tables NOT Protected (Shared Data)

- `companies` - Shared company database (all users can access)
- `company_updates` - Updates to shared companies
- `search_history` - Search history (consider adding RLS if needed)

## Using RLS in Your Code

### Method 1: Using the Helper Function

\`\`\`typescript
import { withRLS } from '@/lib/rls-helper'

export async function GET(request: Request) {
  const accountId = 'user-account-id' // Get from auth
  
  return await withRLS(accountId, async () => {
    // All queries here are automatically filtered by RLS
    const contacts = await sql`SELECT * FROM contacts`
    return Response.json(contacts)
  })
}
\`\`\`

### Method 2: Manual Setup

\`\`\`typescript
import { sql } from '@/lib/db'

export async function GET(request: Request) {
  const accountId = 'user-account-id' // Get from auth
  
  // Set the session variable
  await sql`SET LOCAL app.current_account_id = ${accountId}`
  
  // All subsequent queries are filtered by RLS
  const contacts = await sql`SELECT * FROM contacts`
  
  return Response.json(contacts)
}
\`\`\`

## Bypassing RLS (Admin/Cron Jobs)

For server-side operations like cron jobs that need to access all users' data:

\`\`\`typescript
// Simply don't set the session variable
// RLS policies will not apply

const allReplies = await sql`SELECT * FROM replies`
\`\`\`

## Migration Steps

1. **Run the RLS script**: Execute `scripts/115_enable_row_level_security.sql`

2. **Update existing data**: Set `account_id` for existing rows:
   \`\`\`sql
   -- Example: Update contacts with account_id from zoho_config
   UPDATE contacts c
   SET account_id = z.account_id
   FROM zoho_config z
   WHERE c.account_id IS NULL;
   \`\`\`

3. **Update API routes**: Add RLS context to all API routes that query user data

4. **Test thoroughly**: Ensure users can only see their own data

## Security Considerations

- **Always set account_id**: New rows must have `account_id` set
- **Validate account_id**: Ensure the account_id comes from authenticated source
- **Test isolation**: Verify users cannot access other users' data
- **Monitor performance**: RLS adds a WHERE clause to every query

## Troubleshooting

### "No rows returned" error
- Make sure you're setting the session variable before queries
- Check that `account_id` is set on existing rows

### "Permission denied" error
- Verify the RLS policies are created correctly
- Check that the user has the necessary grants

### Performance issues
- Ensure indexes exist on `account_id` columns
- Consider partitioning large tables by `account_id`
