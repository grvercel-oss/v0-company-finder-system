# Email Sync Cron Job Setup

This system automatically checks for new email replies every 6 hours using Vercel Cron Jobs.

## How It Works

1. **Cron Schedule**: Runs every 6 hours (`0 */6 * * *`)
2. **Redis Tracking**: Stores last checked timestamp per account in Upstash Redis
3. **Email Sync**: Fetches only new emails since last check via Zoho Mail API
4. **Reply Detection**: Matches emails using `In-Reply-To` and `References` headers
5. **Storage**: Saves detected replies to the `replies` database table
6. **Efficiency**: Uses locking to prevent concurrent runs

## Vercel Plan Limitations

**Important**: Vercel's Hobby (free) plan only allows cron jobs that run once per day or less frequently. The current schedule (every 6 hours) requires a Pro plan or higher.

**Options**:
- **Hobby Plan**: Change schedule to `0 0 * * *` (once daily at midnight)
- **Pro Plan**: Keep current schedule or increase frequency up to every minute
- **Manual Checks**: Use the "Check for Replies" button in the inbox for immediate checking

## Database Tables

### `replies` Table
Stores all detected email replies with:
- Contact and thread associations
- Email headers (In-Reply-To, References)
- Full email content
- Processing status

## Redis Keys

- `last_checked:<account_id>` - Timestamp of last email check
- `email-sync-cron` - Lock key to prevent concurrent runs

## Environment Variables

Required for cron functionality:
\`\`\`bash
CRON_SECRET=your_random_secret_string
UPSTASH_KV_KV_REST_API_URL=your_redis_url
UPSTASH_KV_KV_REST_API_TOKEN=your_redis_token
\`\`\`

## Deployment

1. **Run Migration**: Execute `scripts/113_create_replies_table.sql`
2. **Set Cron Secret**: Add `CRON_SECRET` to environment variables
3. **Deploy**: Push to Vercel - cron jobs are automatically configured via `vercel.json`

## Manual Testing

Test the cron endpoint locally:
\`\`\`bash
curl -H "Authorization: Bearer your_cron_secret" \
  http://localhost:3000/api/cron/sync-emails
\`\`\`

## Monitoring

Check cron execution logs in Vercel Dashboard:
- Navigate to your project
- Go to "Cron Jobs" tab
- View execution history and logs

## Performance

- **Execution Time**: ~5-30 seconds depending on email volume
- **Max Duration**: 60 seconds (configurable)
- **Concurrent Protection**: Redis lock prevents overlapping runs
- **Efficient Queries**: Only fetches emails since last check
