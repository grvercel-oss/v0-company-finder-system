-- Enable Row Level Security (RLS) on all user-specific tables
-- This ensures users can only access their own data

-- ============================================================================
-- STEP 1: Add account_id to tables that need it
-- ============================================================================

-- Add account_id to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to email_threads table
ALTER TABLE email_threads 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to email_messages table
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to email_events table
ALTER TABLE email_events 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to company_lists table
ALTER TABLE company_lists 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to outreach_campaigns table
ALTER TABLE outreach_campaigns 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to outreach_contacts table
ALTER TABLE outreach_contacts 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to user_profile table
ALTER TABLE user_profile 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to gmail_accounts table
ALTER TABLE gmail_accounts 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to workflow_jobs table
ALTER TABLE workflow_jobs 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add account_id to ai_usage_tracking table
ALTER TABLE ai_usage_tracking 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- ============================================================================
-- STEP 2: Create indexes for account_id columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_account_id ON email_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_events_account_id ON email_events(account_id);
CREATE INDEX IF NOT EXISTS idx_company_lists_account_id ON company_lists(account_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_account_id ON outreach_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_account_id ON outreach_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_account_id ON user_profile(account_id);
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_account_id ON gmail_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_workflow_jobs_account_id ON workflow_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_account_id ON ai_usage_tracking(account_id);
CREATE INDEX IF NOT EXISTS idx_replies_account_id ON replies(account_id);
CREATE INDEX IF NOT EXISTS idx_zoho_config_account_id ON zoho_config(account_id);

-- ============================================================================
-- STEP 3: Enable RLS on all user-specific tables
-- ============================================================================

ALTER TABLE zoho_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies
-- ============================================================================

-- Policy for zoho_config: Users can only see their own Zoho configuration
DROP POLICY IF EXISTS zoho_config_policy ON zoho_config;
CREATE POLICY zoho_config_policy ON zoho_config
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for gmail_accounts: Users can only see their own Gmail accounts
DROP POLICY IF EXISTS gmail_accounts_policy ON gmail_accounts;
CREATE POLICY gmail_accounts_policy ON gmail_accounts
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for contacts: Users can only see their own contacts
DROP POLICY IF EXISTS contacts_policy ON contacts;
CREATE POLICY contacts_policy ON contacts
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for campaigns: Users can only see their own campaigns
DROP POLICY IF EXISTS campaigns_policy ON campaigns;
CREATE POLICY campaigns_policy ON campaigns
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for email_threads: Users can only see their own email threads
DROP POLICY IF EXISTS email_threads_policy ON email_threads;
CREATE POLICY email_threads_policy ON email_threads
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for email_messages: Users can only see their own email messages
DROP POLICY IF EXISTS email_messages_policy ON email_messages;
CREATE POLICY email_messages_policy ON email_messages
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for replies: Users can only see their own replies
DROP POLICY IF EXISTS replies_policy ON replies;
CREATE POLICY replies_policy ON replies
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for outreach_campaigns: Users can only see their own outreach campaigns
DROP POLICY IF EXISTS outreach_campaigns_policy ON outreach_campaigns;
CREATE POLICY outreach_campaigns_policy ON outreach_campaigns
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for outreach_contacts: Users can only see their own outreach contacts
DROP POLICY IF EXISTS outreach_contacts_policy ON outreach_contacts;
CREATE POLICY outreach_contacts_policy ON outreach_contacts
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for company_lists: Users can only see their own lists
DROP POLICY IF EXISTS company_lists_policy ON company_lists;
CREATE POLICY company_lists_policy ON company_lists
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for company_list_items: Users can only see items in their own lists
DROP POLICY IF EXISTS company_list_items_policy ON company_list_items;
CREATE POLICY company_list_items_policy ON company_list_items
  FOR ALL
  USING (
    list_id IN (
      SELECT id FROM company_lists 
      WHERE account_id = current_setting('app.current_account_id', true)
    )
  );

-- Policy for user_profile: Users can only see their own profile
DROP POLICY IF EXISTS user_profile_policy ON user_profile;
CREATE POLICY user_profile_policy ON user_profile
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for ai_usage_tracking: Users can only see their own AI usage
DROP POLICY IF EXISTS ai_usage_tracking_policy ON ai_usage_tracking;
CREATE POLICY ai_usage_tracking_policy ON ai_usage_tracking
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for email_events: Users can only see their own email events
DROP POLICY IF EXISTS email_events_policy ON email_events;
CREATE POLICY email_events_policy ON email_events
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- Policy for workflow_jobs: Users can only see their own workflow jobs
DROP POLICY IF EXISTS workflow_jobs_policy ON workflow_jobs;
CREATE POLICY workflow_jobs_policy ON workflow_jobs
  FOR ALL
  USING (account_id = current_setting('app.current_account_id', true));

-- ============================================================================
-- STEP 5: Grant necessary permissions
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated;

-- Grant all privileges on tables to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated;

-- ============================================================================
-- NOTES
-- ============================================================================

-- To use RLS in your application, you need to set the current_account_id
-- session variable before running queries. Example in your API routes:
--
-- await sql`SET LOCAL app.current_account_id = ${accountId}`;
-- 
-- Then all subsequent queries in that transaction will be filtered by RLS.
--
-- For the cron job and server-side operations that need to bypass RLS,
-- use a service role or run queries without setting the session variable.
