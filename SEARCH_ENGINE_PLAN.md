# Enhanced Search Engine Implementation Plan

## Overview

This document outlines the plan to transform our company search engine from a single-source, synchronous system into a multi-source, real-time streaming search platform with semantic matching capabilities.

---

## Current System Analysis

### What We Have Now

**Architecture:**
- Single-step synchronous search flow
- Perplexity API → OpenAI enrichment → Database save
- Blocking architecture: one search at a time
- Average wait time: 30-60 seconds
- Results: ~5 companies per search

**Limitations:**
- ❌ No progressive streaming (user waits for all results)
- ❌ No deduplication (each search creates new records)
- ❌ No vector/semantic search
- ❌ Limited to single source (Perplexity)
- ❌ No caching (every search costs money)
- ❌ No ICP extraction (basic filters only)
- ❌ No parallel processing

**Current Cost:** ~$0.05-0.15 per search

**Tech Stack:**
- ✅ Neon PostgreSQL with RLS
- ✅ Upstash Redis
- ✅ OpenAI API
- ✅ Perplexity API
- ✅ Next.js API routes
- ✅ Clerk authentication

---

## Proposed Architecture

### Core Components

#### 1. Query Planner (ICP Extractor)
**Purpose:** Convert raw user query into structured Ideal Customer Profile (ICP)

**Input:** 
\`\`\`
"Find B2B SaaS companies in fintech with 50-200 employees in USA"
\`\`\`

**Output:**
\`\`\`json
{
  "industry": ["fintech", "financial services", "banking"],
  "company_type": "B2B SaaS",
  "employee_range": [50, 200],
  "location": ["USA", "United States"],
  "keywords": ["payment", "banking", "financial software"],
  "search_queries": [
    "fintech B2B SaaS companies USA",
    "financial services software 50-200 employees",
    "payment processing companies United States"
  ]
}
\`\`\`

**Implementation:**
- Use OpenAI GPT-4 (we already have the key)
- Structured output with JSON schema
- Generate 6-12 search queries for different sources
- Store in `search_requests.icp` JSONB column

---

#### 2. Multi-Source Workers

**Worker Interface:**
\`\`\`typescript
interface SearchWorker {
  name: string
  search(query: string, icp: ICP): Promise<CompanyResult[]>
  timeout: number
  cost: number
}
\`\`\`

**Planned Workers:**

1. **PerplexityWorker** (existing, refactor)
   - Uses Perplexity API
   - Searches web for companies
   - Timeout: 60s
   - Cost: ~$0.05 per query

2. **ClutchWorker** (new)
   - Scrapes clutch.co
   - Best for B2B service companies
   - Timeout: 90s
   - Cost: Free (scraping)

3. **GoogleDorkWorker** (new)
   - Google Custom Search API
   - Advanced search operators
   - Timeout: 30s
   - Cost: Free tier (100/day)

4. **LinkedInWorker** (optional, future)
   - LinkedIn company search
   - Requires LinkedIn API access
   - Timeout: 60s
   - Cost: TBD

**Execution:**
- Run all workers in parallel with `Promise.allSettled()`
- Each worker has independent timeout
- Failed workers don't block others
- Stream results as they arrive

---

#### 3. Merger/Deduplicator

**Purpose:** Prevent duplicate companies in database

**Deduplication Logic:**
\`\`\`sql
-- Check by domain (primary)
SELECT * FROM companies WHERE domain = $1

-- Check by name (fallback)
SELECT * FROM companies 
WHERE LOWER(name) = LOWER($1) 
  AND (domain IS NULL OR domain = '')
\`\`\`

**Merge Strategy:**
- If company exists: Update `sources` array, merge data
- If new: Create company record
- Always create `search_results` link

**Data Enrichment:**
- Merge descriptions (keep longest)
- Merge tags (union)
- Merge contact info (emails, phones)
- Track all sources

---

#### 4. Progressive Streaming (SSE)

**Why SSE over WebSocket:**
- Simpler implementation
- Works with serverless
- Auto-reconnect built-in
- One-way communication (perfect for our use case)

**Endpoint:**
\`\`\`
GET /api/search/stream?search_id={uuid}
\`\`\`

**Event Types:**
\`\`\`typescript
// New company found
{ type: 'new_company', data: { company: {...}, source: 'perplexity' } }

// Worker completed
{ type: 'worker_complete', data: { worker: 'clutch', count: 15, duration: 45 } }

// Search completed
{ type: 'search_complete', data: { total: 42, duration: 67 } }

// Error occurred
{ type: 'error', data: { worker: 'google', error: 'Rate limit exceeded' } }
\`\`\`

**Frontend Integration:**
\`\`\`typescript
const eventSource = new EventSource(`/api/search/stream?search_id=${id}`)
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // Update UI in real-time
}
\`\`\`

---

#### 5. Fast Initial Lookup

**Purpose:** Show cached results immediately while workers run

**Flow:**
1. User submits query
2. Extract ICP
3. Query existing companies in DB (simple filters)
4. Return matches immediately (if any)
5. Launch workers in background
6. Stream new results as they arrive

**SQL Query:**
\`\`\`sql
SELECT * FROM companies
WHERE 
  (industry = ANY($1) OR $1 IS NULL)
  AND (location = ANY($2) OR $2 IS NULL)
  AND (employee_count BETWEEN $3 AND $4 OR $3 IS NULL)
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20
\`\`\`

**Benefits:**
- Instant feedback (< 1 second)
- Better UX
- Reuse existing data
- Still get fresh results from workers

---

#### 6. Redis Caching Layer

**Cache Strategy:**

1. **ICP Hash → Company IDs** (TTL: 24h)
\`\`\`typescript
const icpHash = hash(JSON.stringify(icp))
const cachedIds = await redis.get(`icp:${icpHash}`)
\`\`\`

2. **Company Details** (TTL: 7 days)
\`\`\`typescript
const company = await redis.get(`company:${id}`)
\`\`\`

3. **Search Results** (TTL: 1 hour)
\`\`\`typescript
const results = await redis.get(`search:${searchId}`)
\`\`\`

**Invalidation:**
- Company updated → Clear company cache
- New search with same ICP → Extend TTL
- Manual admin action → Clear all

**Expected Savings:**
- 60-80% cache hit rate
- $0.10-0.15 saved per cached search
- 10x faster response time

---

#### 7. Vector Search (Semantic Matching)

**Purpose:** Find similar companies even if keywords don't match

**Example:**
- Query: "AI chatbot companies"
- Semantic matches: "conversational AI", "virtual assistants", "NLP platforms"

**Implementation:**

1. **Embedding Generation:**
\`\`\`typescript
// Batch job: embed all companies
const text = `${company.name} ${company.description} ${company.industry} ${company.tags.join(' ')}`
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text
})
\`\`\`

2. **Vector Index:**
\`\`\`sql
-- Requires pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE companies ADD COLUMN embedding vector(384);

CREATE INDEX ON companies USING ivfflat (embedding vector_cosine_ops);
\`\`\`

3. **Hybrid Search:**
\`\`\`sql
-- Combine vector + keyword search
WITH vector_results AS (
  SELECT id, (1 - (embedding <=> $1)) AS similarity
  FROM companies
  ORDER BY embedding <=> $1
  LIMIT 50
),
keyword_results AS (
  SELECT id, ts_rank(search_vector, query) AS rank
  FROM companies, plainto_tsquery($2) query
  WHERE search_vector @@ query
  LIMIT 50
)
SELECT * FROM companies
WHERE id IN (
  SELECT id FROM vector_results
  UNION
  SELECT id FROM keyword_results
)
ORDER BY (
  COALESCE(vector_results.similarity, 0) * 0.7 +
  COALESCE(keyword_results.rank, 0) * 0.3
) DESC
\`\`\`

**Cost:**
- Embedding: $0.00002 per company (one-time)
- 10,000 companies = $0.20 total
- Query: Free (vector search is local)

---

#### 8. Final Reranker (Optional)

**Purpose:** Use LLM to score and explain relevance of top results

**When to Use:**
- User clicks "Best Matches" filter
- Only for top 50 candidates
- Adds explanation for each match

**Implementation:**
\`\`\`typescript
const prompt = `
Given this search criteria:
${JSON.stringify(icp)}

Rank these companies by relevance (1-10) and explain why:
${companies.map(c => `${c.name}: ${c.description}`).join('\n')}
`

const ranking = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: prompt }],
  response_format: { type: 'json_object' }
})
\`\`\`

**Cost:** ~$0.01-0.02 per search (optional feature)

---

## Database Schema

### New Tables

\`\`\`sql
-- Track all search requests
CREATE TABLE search_requests (
  search_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  raw_query TEXT NOT NULL,
  icp JSONB,
  status TEXT DEFAULT 'started', -- started, running, completed, failed
  desired_count INT DEFAULT 20,
  total_found INT DEFAULT 0,
  cost DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  error TEXT
);

-- Link searches to companies (many-to-many)
CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES search_requests(search_id) ON DELETE CASCADE,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score DOUBLE PRECISION, -- relevance score
  source TEXT NOT NULL, -- which worker found it
  rank INT, -- position in results
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(search_id, company_id)
);

-- Track worker performance
CREATE TABLE worker_stats (
  id SERIAL PRIMARY KEY,
  search_id UUID REFERENCES search_requests(search_id),
  worker_name TEXT NOT NULL,
  status TEXT, -- success, failed, timeout
  companies_found INT DEFAULT 0,
  duration_ms INT,
  cost DECIMAL(10,4),
  error TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_search_requests_account ON search_requests(account_id);
CREATE INDEX idx_search_requests_status ON search_requests(status);
CREATE INDEX idx_search_results_search ON search_results(search_id);
CREATE INDEX idx_search_results_company ON search_results(company_id);
CREATE INDEX idx_worker_stats_search ON worker_stats(search_id);
\`\`\`

### Updated Tables

\`\`\`sql
-- Add to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_embedded BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS embedding vector(384); -- requires pgvector
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'; -- track where found
ALTER TABLE companies ADD COLUMN IF NOT EXISTS emails TEXT[]; -- array of emails
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phones TEXT[]; -- array of phones
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP;

-- Full-text search index
ALTER TABLE companies ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX idx_companies_search ON companies USING gin(search_vector);

-- Update search_vector on insert/update
CREATE OR REPLACE FUNCTION companies_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.industry, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_search_vector_trigger
BEFORE INSERT OR UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION companies_search_vector_update();
\`\`\`

---

## Implementation Phases

### Phase 1: Foundation (Day 1)

**Goal:** Core architecture with streaming

**Tasks:**
1. ✅ Create new database tables (search_requests, search_results, worker_stats)
2. ✅ Build ICP extractor using OpenAI
3. ✅ Implement merger/deduplicator service
4. ✅ Add SSE streaming endpoint (`/api/search/stream`)
5. ✅ Update frontend to consume SSE events

**Deliverable:** Working search with ICP extraction and real-time streaming

**Time:** 1-2 hours

---

### Phase 2: Multi-Source Workers (Day 1-2)

**Goal:** Parallel search across multiple sources

**Tasks:**
1. ✅ Refactor existing Perplexity code into worker pattern
2. ✅ Implement ClutchWorker (web scraping)
3. ✅ Implement GoogleDorkWorker (Custom Search API)
4. ✅ Add parallel execution with Promise.allSettled()
5. ✅ Track worker performance in worker_stats table

**Deliverable:** 3 sources running in parallel with streaming results

**Time:** 2-3 hours

---

### Phase 3: Performance & Caching (Day 2)

**Goal:** 10x faster searches, lower costs

**Tasks:**
1. ✅ Implement fast initial DB lookup
2. ✅ Add Redis caching layer (ICP hash, company details)
3. ✅ Add rate limiting per user
4. ✅ Optimize database queries
5. ✅ Add cost tracking per search

**Deliverable:** Sub-second initial results, 60-80% cache hit rate

**Time:** 2-3 hours

---

### Phase 4: Vector Search (Day 3-4)

**Goal:** Semantic matching for better results

**Tasks:**
1. ✅ Check if Neon supports pgvector extension
2. ✅ Create embedding generation batch job
3. ✅ Implement hybrid search (vector + keyword)
4. ✅ Add background worker to embed new companies
5. ✅ Update search to use hybrid approach

**Deliverable:** Semantic search finding relevant companies even without keyword matches

**Time:** 3-4 hours

**Note:** Requires pgvector extension in Neon

---

### Phase 5: Polish & Admin (Day 4-5)

**Goal:** Production-ready with admin tools

**Tasks:**
1. ✅ Build admin dashboard for search monitoring
2. ✅ Add retry mechanism for failed workers
3. ✅ Implement final reranker (optional)
4. ✅ Add "Export to Campaign" feature
5. ✅ Improve error handling and user feedback
6. ✅ Add search history page

**Deliverable:** Complete production system with admin tools

**Time:** 3-4 hours

---

## Expected Improvements

### Performance

| Metric | Current | After Phase 1-2 | After Phase 3-5 |
|--------|---------|-----------------|-----------------|
| **Time to First Result** | 30-60s | 2-5s | < 1s (cached) |
| **Total Search Time** | 30-60s | 15-30s | 5-15s |
| **Results per Search** | 5 companies | 20-50 companies | 50-100 companies |
| **Sources** | 1 (Perplexity) | 3 (Perplexity, Clutch, Google) | 3+ |
| **Cache Hit Rate** | 0% | 0% | 60-80% |

### Quality

| Metric | Current | After Implementation |
|--------|---------|---------------------|
| **Deduplication** | ❌ None | ✅ Domain + name matching |
| **ICP Extraction** | ❌ Basic filters | ✅ Structured LLM extraction |
| **Semantic Search** | ❌ None | ✅ Vector similarity |
| **Result Relevance** | Medium | High |
| **Data Freshness** | Single source | Multiple sources |

### Cost

| Scenario | Current | After Implementation |
|----------|---------|---------------------|
| **New Search** | $0.05-0.15 | $0.10-0.25 |
| **Cached Search** | $0.05-0.15 | $0.00 (free) |
| **Average (60% cache)** | $0.10 | $0.04 |

**Monthly Savings (1000 searches):**
- Current: $100
- New: $40
- **Savings: $60/month (60%)**

### User Experience

**Before:**
- Submit query → Loading spinner → Wait 30-60s → See 5 results

**After:**
- Submit query → See cached results instantly → Watch new results stream in → 50+ results in 15-30s

---

## Technical Decisions

### Why OpenAI for ICP Extraction?
- ✅ Already have API key
- ✅ GPT-4 excellent at structured extraction
- ✅ JSON schema support
- ✅ Cost-effective ($0.01 per extraction)

### Why SSE over WebSocket?
- ✅ Simpler implementation
- ✅ Works with serverless (Next.js API routes)
- ✅ Auto-reconnect built-in
- ✅ One-way communication (perfect for streaming results)
- ✅ No connection management needed

### Why Upstash Redis?
- ✅ Already connected
- ✅ Serverless-friendly
- ✅ Global replication
- ✅ Free tier sufficient for MVP

### Why pgvector for Embeddings?
- ✅ Native PostgreSQL extension
- ✅ Fast vector similarity search
- ✅ No external service needed
- ✅ Works with existing Neon database

### Why Promise.allSettled() for Workers?
- ✅ Parallel execution
- ✅ Failed workers don't block others
- ✅ Get results from successful workers even if some fail
- ✅ Simple error handling

---

## API Endpoints

### Search Endpoints

\`\`\`typescript
// Start new search
POST /api/search
Body: { query: string, desired_count?: number }
Response: { search_id: string, icp: ICP }

// Stream search results (SSE)
GET /api/search/stream?search_id={uuid}
Events: new_company, worker_complete, search_complete, error

// Get search status
GET /api/search/{search_id}
Response: { status, total_found, workers: [...], results: [...] }

// Get search results
GET /api/search/{search_id}/results
Response: { companies: [...], total: number }

// Cancel search
DELETE /api/search/{search_id}
Response: { success: boolean }
\`\`\`

### Admin Endpoints

\`\`\`typescript
// Get all searches (admin)
GET /api/admin/searches?status=running&limit=50
Response: { searches: [...], total: number }

// Retry failed workers
POST /api/admin/searches/{search_id}/retry
Response: { success: boolean }

// Re-embed companies
POST /api/admin/embeddings/generate
Body: { company_ids?: number[] } // empty = all
Response: { queued: number }

// Get worker stats
GET /api/admin/workers/stats?days=7
Response: { workers: [...], totals: {...} }
\`\`\`

---

## Monitoring & Analytics

### Key Metrics to Track

1. **Search Performance**
   - Average search duration
   - Time to first result
   - Cache hit rate
   - Results per search

2. **Worker Performance**
   - Success rate per worker
   - Average duration per worker
   - Companies found per worker
   - Error rate per worker

3. **Cost Tracking**
   - Cost per search
   - Cost per worker
   - Monthly total cost
   - Cost savings from caching

4. **User Behavior**
   - Searches per user
   - Most common queries
   - Export to campaign rate
   - Search abandonment rate

### Dashboard Views

**Search Monitor:**
- Active searches (real-time)
- Recent searches (last 24h)
- Failed searches (need retry)
- Search queue depth

**Worker Performance:**
- Success rate by worker
- Average duration by worker
- Cost by worker
- Error logs

**Cost Analytics:**
- Daily/weekly/monthly costs
- Cost per search trend
- Cache savings
- Cost by worker

---

## Error Handling

### Worker Failures

**Scenarios:**
1. Worker timeout (> 120s)
2. API rate limit exceeded
3. Network error
4. Parsing error (bad data)
5. Authentication error

**Handling:**
- Log error to `worker_stats` table
- Continue with other workers
- Retry failed worker (max 2 attempts)
- Show user-friendly message
- Don't block search completion

### Search Failures

**Scenarios:**
1. All workers failed
2. ICP extraction failed
3. Database error
4. No results found

**Handling:**
- Mark search as `failed` in database
- Log detailed error
- Show user-friendly error message
- Suggest alternative queries
- Allow manual retry

---

## Future Enhancements

### Phase 6: Advanced Features (Future)

1. **LinkedIn Worker**
   - Requires LinkedIn API access
   - Best for finding decision-makers
   - Cost: TBD

2. **Crunchbase Worker**
   - Funding data
   - Investor information
   - Requires Crunchbase API

3. **Apollo.io Integration**
   - Contact enrichment
   - Email verification
   - Phone numbers

4. **AI-Powered Insights**
   - Company growth predictions
   - Competitor analysis
   - Market trends

5. **Saved Searches**
   - Save ICP profiles
   - Auto-run searches daily/weekly
   - Email notifications for new matches

6. **Collaborative Filtering**
   - "Users who searched for X also searched for Y"
   - Recommend similar companies
   - Learn from user behavior

---

## Testing Strategy

### Unit Tests
- ICP extractor accuracy
- Deduplication logic
- Worker timeout handling
- Cache invalidation

### Integration Tests
- End-to-end search flow
- SSE streaming
- Database transactions
- Worker coordination

### Performance Tests
- Load testing (100 concurrent searches)
- Cache performance
- Database query optimization
- Worker parallelization

### User Acceptance Tests
- Search relevance
- UI responsiveness
- Error messages
- Export to campaign

---

## Rollout Plan

### Phase 1: Internal Testing (Day 1)
- Deploy to staging
- Test with team
- Fix critical bugs
- Validate cost estimates

### Phase 2: Beta Users (Day 2-3)
- Enable for 10% of users
- Monitor performance
- Collect feedback
- Iterate on UX

### Phase 3: Full Rollout (Day 4-5)
- Enable for all users
- Monitor costs
- Track metrics
- Optimize based on usage

### Phase 4: Optimization (Week 2)
- Add more workers based on demand
- Tune cache TTLs
- Optimize database queries
- Reduce costs

---

## Success Criteria

### Must Have (Phase 1-2)
- ✅ Search completes in < 30s
- ✅ At least 20 results per search
- ✅ Real-time streaming works
- ✅ No duplicate companies
- ✅ Cost < $0.25 per search

### Should Have (Phase 3-4)
- ✅ First results in < 5s
- ✅ Cache hit rate > 50%
- ✅ Semantic search working
- ✅ 3+ data sources
- ✅ Cost < $0.15 per search (with caching)

### Nice to Have (Phase 5)
- ✅ Admin dashboard
- ✅ Search history
- ✅ Export to campaign
- ✅ Final reranker
- ✅ Cost < $0.10 per search

---

## Risks & Mitigations

### Risk: Worker Timeouts
**Impact:** Slow searches, poor UX
**Mitigation:** 
- Set aggressive timeouts (60-120s)
- Use Promise.allSettled() to not block
- Show partial results immediately

### Risk: High API Costs
**Impact:** Unsustainable economics
**Mitigation:**
- Implement aggressive caching
- Rate limit users
- Monitor costs daily
- Optimize worker selection

### Risk: Poor Result Quality
**Impact:** Users don't trust results
**Mitigation:**
- Implement deduplication
- Add semantic search
- Use final reranker
- Collect user feedback

### Risk: Database Performance
**Impact:** Slow queries, timeouts
**Mitigation:**
- Add proper indexes
- Use connection pooling
- Implement caching
- Monitor query performance

### Risk: Scraping Blocks
**Impact:** Workers fail frequently
**Mitigation:**
- Rotate user agents
- Add delays between requests
- Use proxy services if needed
- Have fallback workers

---

## Conclusion

This plan transforms our search engine from a simple single-source tool into a sophisticated multi-source platform with real-time streaming, semantic search, and intelligent caching. The phased approach allows us to deliver value incrementally while managing risk and cost.

**Key Benefits:**
- 🚀 10x faster time to first result
- 📈 10x more results per search
- 💰 60% cost reduction (with caching)
- 🎯 Better result quality (semantic search)
- ✨ Superior UX (real-time streaming)

**Next Steps:**
1. Review and approve this plan
2. Start Phase 1 implementation
3. Test with internal team
4. Roll out to users incrementally
5. Monitor and optimize

---

*Last Updated: 2025-11-04*
*Version: 1.0*
