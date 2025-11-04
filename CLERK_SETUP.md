# Clerk Authentication Setup

This application uses Clerk for authentication. Follow these steps to set up Clerk:

## 1. Create a Clerk Account

1. Go to [clerk.com](https://clerk.com) and sign up
2. Create a new application
3. Choose your preferred authentication methods (Email, Google, etc.)

## 2. Add Environment Variables

Add these environment variables to your Vercel project or `.env.local`:

\`\`\`env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
\`\`\`

You can find these in your Clerk Dashboard under "API Keys".

## 3. Configure Clerk Webhook (Important!)

To sync users to your database:

1. Go to Clerk Dashboard → Webhooks
2. Add a new endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to these events:
   - `user.created`
   - `user.updated`
4. Copy the webhook secret and add it as `CLERK_WEBHOOK_SECRET`

## 4. Update Sign-in/Sign-up URLs

In your Clerk Dashboard, set:
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/`
- After sign-up URL: `/`

## 5. Database Sync

The webhook automatically syncs Clerk users to your `accounts` table using the Clerk user ID as the primary key. This ensures:
- Row Level Security (RLS) works with Clerk user IDs
- All existing relationships (campaigns, lists, etc.) are tied to the correct user

## 6. Migration from Custom Auth

If you're migrating from the custom authentication system:

1. Export existing user data from the `accounts` table
2. Create corresponding Clerk users (or invite them to sign up)
3. Update the `accounts` table to use Clerk user IDs
4. Remove old authentication routes and components

## Features

- ✅ Email/Password authentication
- ✅ OAuth providers (Google, GitHub, etc.)
- ✅ User profile management
- ✅ Session management
- ✅ Automatic user sync to database
- ✅ Row Level Security integration

## Sign Out Configuration

When users sign out, Clerk will automatically redirect them to the home page (`/`). The landing page will show:
- Sign In and Sign Up buttons for unauthenticated users
- Dashboard access for authenticated users (auto-redirects to `/dashboard`)

The middleware is configured to allow public access to:
- `/` - Landing page
- `/sign-in` - Clerk sign in page
- `/sign-up` - Clerk sign up page
- `/api/webhooks` - Webhook endpoints

All other routes require authentication and will redirect to the sign-in page.
