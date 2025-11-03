# Row Level Security (RLS) Implementation Guide

## Overview

Row Level Security has been implemented across the application to ensure users can only access their own data. This document explains how RLS works and how to use it in your code.

## How It Works

1. **Account ID Context**: Each database query runs with an `account_id` context set via PostgreSQL session variables
2. **RLS Policies**: Database policies automatically filter rows based on the current `account_id`
3. **Helper Functions**: Use `withRLS()` to automatically set context before queries

## Using RLS in API Routes

### Standard Pattern

\`\`\`typescript
import { getAccountIdFromRequest, withRLS } from "@/lib/rls-helper"

export async function GET(request: Request) {
  // 1. Get account_id from request
  const accountId = await getAccountIdFromRequest(request)
  
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Execute queries with RLS context
  const data = await withRLS(accountId, async () => {
    return await sql`SELECT * FROM contacts`
  })

  return NextResponse.json({ data })
}
\`\`\`

### Cron Jobs / Admin Operations

For operations that need to access all data (like cron jobs), use `bypassRLS()`:

\`\`\`typescript
import { bypassRLS } from "@/lib/rls-helper"

export async function GET(request: Request) {
  // Verify authorization first!
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Bypass RLS for admin operations
  await bypassRLS()
  
  const allData = await sql`SELECT * FROM contacts`
  
  return NextResponse.json({ data: allData })
}
\`\`\`

## Account ID Sources

The `getAccountIdFromRequest()` function checks multiple sources in order:

1. **Header**: `x-account-id` header (for API calls)
2. **Cookie**: `account_id` cookie (for browser requests)
3. **Zoho Config**: Falls back to active Zoho account (single-user setups)

## Setting Account ID

### From Client (Browser)

Set a cookie when user logs in:

\`\`\`typescript
document.cookie = `account_id=${accountId}; path=/; max-age=31536000`
\`\`\`

### From API Client

Include header in requests:

\`\`\`typescript
fetch('/api/contacts', {
  headers: {
    'x-account-id': accountId
  }
})
\`\`\`

## Updated Routes

The following routes have been updated to use RLS:

- ✅ `/api/zoho/config` - Zoho configuration
- ✅ `/api/profile` - User profile
- ✅ `/api/notifications/replies` - Reply notifications
- ✅ `/api/cron/sync-emails` - Email sync (bypasses RLS)

## Routes That Need Updating

The following routes still need RLS implementation:

- `/api/campaigns/*` - Campaign management
- `/api/contacts/*` - Contact management
- `/api/emails/*` - Email operations
- `/api/lists/*` - List management
- `/api/analytics/*` - Analytics endpoints

## Testing RLS

### Test User Isolation

\`\`\`sql
-- Set account context
SET LOCAL app.current_account_id = 'user1@example.com';

-- Should only see user1's data
SELECT * FROM contacts;

-- Switch to different user
SET LOCAL app.current_account_id = 'user2@example.com';

-- Should only see user2's data
SELECT * FROM contacts;
\`\`\`

### Test Bypass

\`\`\`sql
-- Bypass RLS
SET LOCAL app.bypass_rls = 'true';

-- Should see all data
SELECT * FROM contacts;
\`\`\`

## Security Checklist

- [ ] All API routes validate account_id before queries
- [ ] Cron jobs use `bypassRLS()` with proper authorization
- [ ] Client sets account_id via cookie or header
- [ ] RLS policies are enabled on all user-specific tables
- [ ] Admin operations verify authorization before bypassing RLS

## Troubleshooting

### "No rows returned" but data exists

- Check if account_id is set correctly
- Verify RLS policies are not too restrictive
- Use `bypassRLS()` temporarily to debug

### "Unauthorized" errors

- Ensure account_id cookie/header is set
- Check if Zoho config has account_id
- Verify user is logged in

### Performance issues

- Ensure indexes exist on account_id columns
- Use `EXPLAIN ANALYZE` to check query plans
- Consider caching account_id lookups
