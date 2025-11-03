# Database Schema Documentation

## Overview
This document provides a comprehensive overview of the database schema for the Company Finder System. The database uses PostgreSQL (via Neon) and contains 21 tables across 2 schemas: `public` and `neon_auth`.

---

## Schema: neon_auth

### Table: users_sync
Synchronization table for user authentication data.

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PRIMARY KEY |
| email | text | |
| name | text | |
| raw_json | jsonb | |
| created_at | timestamp with time zone | |
| updated_at | timestamp with time zone | |
| deleted_at | timestamp with time zone | |

**RLS Status:** Disabled

---

## Schema: public

### Table: accounts
User account management table.

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PRIMARY KEY |
| email | text | |
| password_hash | text | |
| full_name | text | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |
| last_login_at | timestamp without time zone | |

**RLS Status:** Disabled

---

### Table: ai_usage_tracking
Tracks AI model usage and costs for campaigns and contacts.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| campaign_id | integer | FOREIGN KEY → campaigns(id) |
| contact_id | integer | FOREIGN KEY → contacts(id) |
| model | character varying | |
| generation_type | character varying | |
| prompt_tokens | integer | |
| completion_tokens | integer | |
| total_tokens | integer | |
| cost_usd | numeric | |
| created_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `ai_usage_tracking_policy` (ALL operations)

---

### Table: campaigns
Email outreach campaigns.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| name | character varying | |
| description | text | |
| status | character varying | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `campaigns_policy` (ALL operations)

---

### Table: companies
Company information and metadata.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| name | character varying | |
| domain | character varying | |
| website | character varying | |
| description | text | |
| industry | character varying | |
| size | character varying | |
| employee_count | character varying | |
| location | character varying | |
| founded_year | integer | |
| revenue_range | character varying | |
| funding_stage | character varying | |
| total_funding | character varying | |
| linkedin_url | character varying | |
| twitter_url | character varying | |
| logo_url | character varying | |
| technologies | ARRAY | |
| keywords | ARRAY | |
| ai_summary | text | |
| raw_data | jsonb | |
| data_quality_score | integer | |
| verified | boolean | |
| created_at | timestamp without time zone | |
| last_updated | timestamp without time zone | |

**RLS Status:** Disabled

---

### Table: company_list_items
Junction table linking companies to lists.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| list_id | integer | FOREIGN KEY → company_lists(id) |
| company_id | integer | FOREIGN KEY → companies(id) |
| notes | text | |
| added_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `company_list_items_policy` (ALL operations)

---

### Table: company_lists
User-created lists of companies.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| name | character varying | |
| description | text | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `company_lists_policy` (ALL operations)

---

### Table: company_updates
Tracks changes to company records.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| company_id | integer | FOREIGN KEY → companies(id) |
| update_type | character varying | |
| changes | jsonb | |
| updated_at | timestamp without time zone | |

**RLS Status:** Disabled

---

### Table: contacts
Contact information and email campaign tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| campaign_id | integer | FOREIGN KEY → campaigns(id) |
| thread_id | integer | FOREIGN KEY → email_threads(id) |
| email | character varying | |
| first_name | character varying | |
| last_name | character varying | |
| job_title | character varying | |
| company_name | character varying | |
| subject | text | |
| original_subject | text | |
| body | text | |
| original_body | text | |
| status | character varying | |
| sent_at | timestamp without time zone | |
| reply_received_at | timestamp without time zone | |
| last_reply_check_at | timestamp without time zone | |
| failed_reason | text | |
| generation_count | integer | |
| edited_at | timestamp without time zone | |
| outlook_message_id | character varying | |
| zoho_message_id | character varying | |
| zoho_thread_id | character varying | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `contacts_policy` (ALL operations)

---

### Table: email_events
Tracks email events (opens, clicks, etc.).

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| contact_id | integer | FOREIGN KEY → contacts(id) |
| message_id | text | |
| thread_id | text | |
| event_type | text | |
| event_data | jsonb | |
| created_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `email_events_policy` (ALL operations)

---

### Table: email_messages
Stores all email messages (sent and received).

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| thread_id | integer | FOREIGN KEY → email_threads(id) |
| message_id | character varying | |
| outlook_message_id | character varying | |
| zoho_message_id | character varying | |
| provider | character varying | Provider used ('outlook' or 'zoho') |
| direction | character varying | 'sent' or 'received' |
| from_email | character varying | |
| from_name | character varying | |
| to_email | character varying | |
| to_name | character varying | |
| subject | character varying | |
| body | text | Plain text body |
| html_body | text | HTML body |
| is_ai_generated | boolean | |
| ai_prompt | text | |
| is_read | boolean | |
| sent_at | timestamp without time zone | |
| received_at | timestamp without time zone | |
| created_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `email_messages_policy` (ALL operations)

---

### Table: email_threads
Email conversation threads.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| contact_id | integer | FOREIGN KEY → contacts(id) |
| campaign_id | integer | FOREIGN KEY → campaigns(id) |
| thread_id | character varying | External thread ID |
| subject | character varying | |
| status | character varying | |
| message_count | integer | |
| reply_count | integer | |
| has_unread_replies | boolean | |
| last_message_at | timestamp without time zone | |
| last_reply_at | timestamp without time zone | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `email_threads_policy` (ALL operations)

---

### Table: gmail_accounts
Gmail OAuth configuration (legacy).

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| email | text | |
| access_token | text | |
| refresh_token | text | |
| token_expiry | timestamp without time zone | |
| is_active | boolean | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `gmail_accounts_policy` (ALL operations)

---

### Table: outlook_config
Outlook OAuth configuration and tokens.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| email | text | |
| access_token | text | |
| refresh_token | text | |
| expires_at | bigint | Token expiration timestamp |
| provider | character varying | Always 'outlook' |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (4 policies)
- Users can view their own outlook config (SELECT)
- Users can insert their own outlook config (INSERT)
- Users can update their own outlook config (UPDATE)
- Users can delete their own outlook config (DELETE)

---

### Table: outreach_campaigns
Outreach campaign tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| name | text | |
| offer_description | text | |
| status | text | |
| total_contacts | integer | |
| emails_sent | integer | |
| replies_received | integer | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `outreach_campaigns_policy` (ALL operations)

---

### Table: outreach_contacts
Contacts for outreach campaigns.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| campaign_id | integer | FOREIGN KEY → outreach_campaigns(id) |
| email | text | |
| contact_name | text | |
| company_name | text | |
| company_info | jsonb | |
| email_subject | text | |
| email_body | text | |
| followup_subject | text | |
| followup_body | text | |
| status | text | |
| message_id | text | |
| followup_message_id | text | |
| thread_id | text | |
| sent_at | timestamp without time zone | |
| followup_sent_at | timestamp without time zone | |
| opened_at | timestamp without time zone | |
| replied_at | timestamp without time zone | |
| last_checked_at | timestamp without time zone | |
| notes | text | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `outreach_contacts_policy` (ALL operations)

---

### Table: replies
Tracks email replies received.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| contact_id | integer | FOREIGN KEY → contacts(id) |
| thread_id | text | |
| message_id | text | |
| outlook_message_id | character varying | |
| zoho_message_id | text | |
| from_email | text | |
| from_name | text | |
| subject | text | |
| body_text | text | Plain text body |
| body_html | text | HTML body |
| in_reply_to | text | |
| email_references | text | |
| received_at | timestamp without time zone | |
| detected_at | timestamp without time zone | |
| processed | boolean | |
| notification_shown | boolean | |
| notification_shown_at | timestamp without time zone | |
| notification_clicked | boolean | |
| created_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `replies_policy` (ALL operations)

---

### Table: search_history
Tracks company search queries and costs.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| query | text | |
| filters | jsonb | |
| results_count | integer | |
| perplexity_input_tokens | integer | |
| perplexity_output_tokens | integer | |
| perplexity_cost | numeric | |
| openai_input_tokens | integer | |
| openai_output_tokens | integer | |
| openai_cost | numeric | |
| total_cost | numeric | |
| search_timestamp | timestamp without time zone | |

**RLS Status:** Disabled

---

### Table: user_profile
User profile information.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| email | character varying | |
| full_name | character varying | |
| company | character varying | |
| phone | character varying | |
| website | character varying | |
| linkedin_url | character varying | |
| twitter_url | character varying | |
| signature | text | Email signature |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `user_profile_policy` (ALL operations)

---

### Table: workflow_jobs
Background job queue for workflows.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | text | |
| contact_id | integer | FOREIGN KEY → contacts(id) |
| job_type | text | |
| status | text | |
| scheduled_at | timestamp without time zone | |
| executed_at | timestamp without time zone | |
| error_message | text | |
| created_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `workflow_jobs_policy` (ALL operations)

---

### Table: zoho_config
Zoho OAuth configuration and tokens.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY |
| account_id | character varying | Legacy field |
| user_account_id | text | Current account ID field |
| account_email | character varying | |
| account_name | character varying | |
| data_center | character varying | Zoho datacenter (e.g., 'eu', 'com') |
| access_token | text | |
| refresh_token | text | |
| token_expires_at | timestamp without time zone | |
| provider | character varying | Always 'zoho' |
| is_active | boolean | |
| webhook_id_sent | character varying | |
| webhook_id_received | character varying | |
| webhook_id_opened | character varying | |
| webhook_created_at | timestamp without time zone | |
| webhook_creation_failed | boolean | |
| webhook_creation_error | text | |
| webhook_creation_attempts | integer | |
| webhook_last_attempt_at | timestamp without time zone | |
| last_tested_at | timestamp without time zone | |
| created_at | timestamp without time zone | |
| updated_at | timestamp without time zone | |

**RLS Status:** Enabled (1 policy)
- `zoho_config_policy` (ALL operations)

---

## Key Relationships

### Email System
- `email_threads` → `contacts` (one-to-one)
- `email_threads` → `email_messages` (one-to-many)
- `email_threads` → `replies` (one-to-many via thread_id)
- `contacts` → `campaigns` (many-to-one)

### Company Management
- `company_lists` → `company_list_items` → `companies` (many-to-many)
- `companies` → `company_updates` (one-to-many)

### Outreach System
- `outreach_campaigns` → `outreach_contacts` (one-to-many)

### Configuration
- `outlook_config` and `zoho_config` store OAuth tokens per account
- Only one provider should be active per account at a time

### Tracking
- `ai_usage_tracking` tracks AI costs per campaign/contact
- `email_events` tracks email interactions
- `workflow_jobs` manages background tasks

---

## Important Notes

1. **Single-User Mode**: The application currently operates in single-user mode where `account_id` is stored but not actively filtered in most queries.

2. **Provider Field**: The `email_messages` table has a `provider` field ('outlook' or 'zoho') to track which service sent each message.

3. **RLS Policies**: Most tables have Row Level Security enabled with policies, but the application doesn't currently enforce multi-tenant isolation.

4. **Dual Message IDs**: Both `outlook_message_id` and `zoho_message_id` fields exist in several tables to support both email providers.

5. **Thread Tracking**: Email threads are tracked using both internal `thread_id` (integer) and external provider-specific thread IDs (text).

6. **Account ID Fields**: 
   - `outlook_config.account_id` is UUID type
   - `zoho_config.user_account_id` is UUID type (newer field)
   - `zoho_config.account_id` is VARCHAR type (legacy field)
   - Most other tables use TEXT type for account_id
