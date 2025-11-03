# Gmail Integration Implementation Plan

This document outlines the complete plan for implementing Gmail integration that works the same as Outlook and Zoho - sending emails, searching, and getting replies.

## 1. Architecture Overview

The Gmail integration follows the same pattern as Outlook and Zoho:

### Components Needed

- `lib/gmail-oauth.ts` - OAuth token management and refresh
- `lib/gmail-mail.ts` - Gmail API operations (send, search, fetch messages)
- `app/api/gmail/oauth/route.ts` - OAuth initiation endpoint
- `app/api/gmail/oauth/callback/route.ts` - OAuth callback handler
- Update `lib/email-provider.ts` - Add Gmail settings interface
- Update `app/api/emails/send/route.ts` - Add Gmail sending logic
- Update `app/api/emails/check-replies/route.ts` - Add Gmail reply checking

## 2. Gmail API Requirements

### OAuth 2.0 Scopes Needed

- `https://www.googleapis.com/auth/gmail.send` - Send emails
- `https://www.googleapis.com/auth/gmail.readonly` - Read messages
- `https://www.googleapis.com/auth/gmail.modify` - Mark as read

### Environment Variables

\`\`\`env
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
\`\`\`

### Key Differences from Outlook/Zoho

1. **Message Format**: Gmail uses base64url-encoded RFC 2822 format
2. **Thread Detection**: Gmail has native thread support via `threadId`
3. **Label System**: Uses labels instead of folders (INBOX, SENT, etc.)
4. **Rate Limits**: 250 quota units per user per second

## 3. Gmail Settings Interface

\`\`\`typescript
export interface GmailSettings {
  email: string
  access_token: string
  refresh_token: string
  expires_at: number
  gmail_user_id: string // "me" or actual user ID
}
\`\`\`

## 4. Core Functions to Implement

### OAuth Functions (`lib/gmail-oauth.ts`)

- `getGmailAuthUrl()` - Generate OAuth URL
- `exchangeCodeForTokens()` - Exchange code for tokens
- `refreshGmailToken()` - Refresh access token
- `getGmailConfig()` - Get stored configuration
- `getUserProfile()` - Get user email from Gmail API

### Mail Functions (`lib/gmail-mail.ts`)

- `sendGmailEmail()` - Send new email
- `sendGmailReply()` - Reply to existing thread
- `getGmailMessages()` - Fetch inbox messages with filters
- `getGmailMessageById()` - Get specific message details
- `searchGmailMessages()` - Search with query
- `isGmailReply()` - Check if message is a reply (using headers)
- `markGmailAsRead()` - Mark message as read

## 5. Gmail API Endpoints

### Send Email

\`\`\`
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
Body: { raw: base64url_encoded_email }
\`\`\`

### List Messages

\`\`\`
GET https://gmail.googleapis.com/gmail/v1/users/me/messages
Query: ?labelIds=INBOX&maxResults=100&q=after:2024/01/01
\`\`\`

### Get Message

\`\`\`
GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}
Query: ?format=full
\`\`\`

### Modify Message (mark as read)

\`\`\`
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}/modify
Body: { removeLabelIds: ["UNREAD"] }
\`\`\`

## 6. Message Structure Mapping

### Gmail API Response → Our Format

\`\`\`typescript
{
  id: message.id,
  threadId: message.threadId,
  from: headers.find(h => h.name === 'From').value,
  to: headers.find(h => h.name === 'To').value,
  subject: headers.find(h => h.name === 'Subject').value,
  body: payload.body.data (base64 decoded),
  receivedDateTime: internalDate (milliseconds),
  inReplyTo: headers.find(h => h.name === 'In-Reply-To').value,
  references: headers.find(h => h.name === 'References').value
}
\`\`\`

## 7. Reply Detection Strategy

Gmail makes this easier than Zoho:

1. **Use `threadId`**: All messages in a conversation share the same `threadId`
2. **Check Headers**: Look for `In-Reply-To` and `References` headers
3. **Filter by Label**: Use `labelIds=INBOX` to exclude sent messages
4. **Match to Contacts**: Compare sender email with contacts in database

## 8. Implementation Steps

### Phase 1: OAuth Setup

1. Create Gmail OAuth credentials in Google Cloud Console
2. Implement `lib/gmail-oauth.ts` with token management
3. Create OAuth initiation and callback routes
4. Add Gmail to provider settings interface

### Phase 2: Sending Emails

5. Implement `sendGmailEmail()` with base64 encoding
6. Add Gmail case to `/api/emails/send` route
7. Test sending emails through Gmail

### Phase 3: Reading & Reply Detection

8. Implement `getGmailMessages()` with INBOX filter
9. Implement reply detection using headers and threadId
10. Add Gmail case to `/api/emails/check-replies` route
11. Test reply detection and matching

### Phase 4: UI Integration

12. Add Gmail connection button to settings page
13. Display Gmail status in provider list
14. Test full flow: connect → send → receive reply → detect

## 9. Key Implementation Details

### Base64 Encoding for Sending

\`\`\`typescript
function createRFC2822Email(to: string, subject: string, body: string, from: string) {
  const email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    body
  ].join('\r\n')
  
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
\`\`\`

### Reply Detection

\`\`\`typescript
function isGmailReply(message: GmailMessage): boolean {
  const headers = message.payload.headers
  const inReplyTo = headers.find(h => h.name === 'In-Reply-To')
  const references = headers.find(h => h.name === 'References')
  return !!(inReplyTo || references)
}
\`\`\`

### Inbox Filtering

\`\`\`typescript
// Only get inbox messages, exclude sent
const query = 'in:inbox -in:sent after:2024/01/01'
const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`
\`\`\`

## 10. Error Handling

### Common Gmail API Errors

- `401 Unauthorized` → Refresh token
- `403 Forbidden` → Check scopes
- `429 Too Many Requests` → Implement rate limiting
- `400 Bad Request` → Validate email format

### Retry Strategy

Same as Outlook - attempt with existing token, if 401, refresh and retry once.

## 11. Testing Checklist

- [ ] OAuth flow connects successfully
- [ ] Tokens are stored and refreshed correctly
- [ ] Can send email to external address
- [ ] Sent email appears in Gmail Sent folder
- [ ] Can receive reply from external address
- [ ] Reply is detected and matched to original contact
- [ ] Reply is saved to database with correct thread
- [ ] Can mark messages as read
- [ ] Multiple accounts can be connected
- [ ] Token refresh works after expiration

## 12. Database Schema

No changes needed to existing schema. Gmail will use the same tables:

- `account_email_provider` - Store Gmail OAuth tokens and settings
- `email_threads` - Store email conversations
- `email_messages` - Store individual messages
- `replies` - Store detected replies

The `settings` JSONB column in `account_email_provider` will store the `GmailSettings` interface.

## 13. Rate Limiting Considerations

Gmail API has quota limits:

- **Per-user rate limit**: 250 quota units/second/user
- **Daily limit**: 1 billion quota units/day
- **Batch requests**: Up to 100 requests per batch

### Quota Costs

- `messages.send`: 100 units
- `messages.list`: 5 units
- `messages.get`: 5 units
- `messages.modify`: 5 units

### Implementation Strategy

- Implement exponential backoff for 429 errors
- Cache message lists when possible
- Use batch requests for bulk operations
- Monitor quota usage in logs

## 14. Security Considerations

1. **Token Storage**: Store refresh tokens encrypted in database
2. **Scope Minimization**: Only request necessary scopes
3. **Token Rotation**: Implement automatic token refresh
4. **Error Logging**: Never log access tokens or refresh tokens
5. **HTTPS Only**: All OAuth redirects must use HTTPS

## 15. Future Enhancements

- **Gmail Labels**: Support custom labels for organization
- **Attachments**: Handle file attachments in emails
- **Rich Formatting**: Support full HTML email templates
- **Batch Operations**: Send multiple emails efficiently
- **Webhooks**: Use Gmail Push Notifications for real-time updates
- **Search Filters**: Advanced search with Gmail query syntax
- **Draft Support**: Save and send drafts

---

**Status**: Planning Complete - Ready for Implementation

**Last Updated**: 2025-11-03
