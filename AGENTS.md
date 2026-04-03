# Spec: Salesforce Documentation Semantic Search MCP Server

## Objective

Build a read-only remote MCP server that lets an AI agent semantically search the public Salesforce developer documentation and fetch the underlying source content with strong citations.

The server must:

- expose a Streamable HTTP MCP endpoint at `/mcp`
- crawl and index the public Salesforce documentation corpus
- support semantic and hybrid retrieval over the indexed corpus
- return canonical URLs, titles, and text spans suitable for model citations
- be easy to run locally and easy to deploy as a hosted service
- be usable from Codex via remote MCP configuration

## Product requirements

### Core use cases

1. Given a natural-language query like `How do I authenticate with the Tooling API?`, return the most relevant Salesforce docs pages and sections.
2. Given a result ID or canonical URL, return the full normalized text for that document or section.
3. Preserve enough metadata for the agent to cite the original Salesforce page accurately.
4. Prefer exact docs over paraphrased blog content or forum content. This server is for official Salesforce docs only.

### Non-goals

- No write actions.
- No crawling of authenticated/private Salesforce properties.
- No indexing of non-Salesforce third-party pages.
- No browser automation unless needed as a fallback for pages that fail static extraction.

## Recommended architecture

### Recommended stack

- Language: TypeScript
- MCP framework: official MCP TypeScript SDK using Streamable HTTP
- HTTP framework: Hono or Express
- Vector store: Qdrant
- Metadata store: PostgreSQL
- Embeddings: OpenAI `text-embedding-3-large` with reduced dimensions (1024 recommended) or `text-embedding-3-small` for lower cost
- Lexical search: PostgreSQL `tsvector` or Qdrant sparse+dense hybrid
- Queue/background jobs: lightweight in-process job runner first, upgrade to BullMQ if needed
- Deployment: Fly.io, Render, Cloud Run, or a small container platform
- Storage for crawl artifacts: object storage or local disk in dev

### Why this stack

- TypeScript gives the cleanest path to a first-class Streamable HTTP MCP server.
- Qdrant makes dense+sparse hybrid retrieval and RRF straightforward.
- PostgreSQL keeps metadata, crawl state, dedupe hashes, and audit data simple.
- The server is read-only and query-driven, so stateless MCP is preferred for easier scaling.

## Corpus definition

Index only public official Salesforce documentation from `developer.salesforce.com`, seeded from the public sitemaps referenced by `robots.txt`.

Initial scope:
- `https://developer.salesforce.com/docs-atlas-sitemap.xml`
- `https://developer.salesforce.com/docs/ssg-sitemap.xml`

Do not crawl:
- site search endpoints
- query-string variants
- community/forum/blog pages outside the docs corpus
- pages blocked by robots or explicitly excluded by config

## Crawl strategy

### Discovery

1. Fetch `robots.txt`.
2. Parse the docs sitemap URLs.
3. Fetch sitemap indexes / sitemap files.
4. Expand to a canonical URL list.
5. Filter against allow/deny regexes.

### Canonicalization rules

Normalize by:
- lowercasing host
- stripping fragments
- stripping query strings except when explicitly whitelisted
- preserving path
- resolving redirects
- storing both raw URL and canonical URL

### Fetching

For each candidate URL:
1. Request HTML with a descriptive user agent.
2. If HTML extraction succeeds, parse and normalize.
3. If the page is a PDF, extract text and page-level metadata.
4. If the page appears empty or obviously JS-rendered, mark it as `needs_render`.
5. Optional fallback: headless browser render for `needs_render` pages, capped by budget and rate limits.

### Rate limiting and politeness

- configurable concurrency
- per-host rate limit
- retry with exponential backoff
- honor robots
- conditional requests when possible using ETag / Last-Modified

## Content extraction

### HTML extraction goals

Extract:
- page title
- H1/H2/H3 hierarchy
- breadcrumbs if available
- main content body
- code blocks
- tables
- admonitions / notes / warnings
- canonical URL
- last modified when available
- product or guide family inferred from URL

Ignore:
- nav chrome
- cookie banners
- footer boilerplate
- repeated left-nav TOC noise
- “copy page” / UI scaffolding
- unrelated recommendation widgets

### Sectionization

After page extraction, split each page into hierarchical sections:

- document
- section
- subsection

Each indexed chunk must retain:
- `doc_id`
- `chunk_id`
- `canonical_url`
- `url_with_anchor` if applicable
- `title`
- `section_path`
- `text`
- `source_type` (`html` or `pdf`)
- `product_family`
- `headings`
- `crawl_timestamp`
- `content_hash`

### Chunking

Use structure-aware chunking, not blind token windows.

Recommended rules:
- chunk by heading boundaries first
- target 400 to 900 tokens per chunk
- allow overlap of 80 to 150 tokens when splitting long sections
- keep code blocks with the nearest explanatory text
- do not merge unrelated headings into one chunk
- keep a page-level “full text” record for fetch responses

## Indexing strategy

### Retrieval design

Use hybrid retrieval:
1. lexical search for exact API names, field names, commands, and acronyms
2. dense vector search for semantic intent
3. optional reranking over the merged candidate set

### Recommended index layout

#### Metadata table
Stores:
- document identity
- crawl status
- hashes
- timestamps
- canonical URL
- titles
- page-level full text

#### Chunk table
Stores:
- chunk text
- headings
- token count
- offsets
- doc references

#### Vector collection
Stores:
- dense embedding
- optional sparse vector
- payload metadata:
  - doc/chunk ids
  - titles
  - URLs
  - headings
  - product family

### Ranking pipeline

1. Generate query embedding.
2. Run dense retrieval top 40.
3. Run lexical retrieval top 40.
4. Fuse with RRF.
5. Optional rerank top 20 with a reranker.
6. Return top 8 to the agent.

### Why hybrid matters

Salesforce docs contain many queries where exact tokens matter:
- API versions like `v63.0`
- object names like `ContentVersion`
- CLI commands like `sf project deploy start`
- acronyms like SOQL, SOSL, LWC, SFDX

Dense-only retrieval will miss some of these; lexical-only retrieval will miss conceptual queries.

## MCP surface

### Transport

- Streamable HTTP
- single endpoint: `/mcp`
- support POST and GET per MCP transport requirements
- default to stateless operation
- optionally enable session IDs later if a client demands resumability

### Tools

Implement these tools first.

#### 1. `search`
Read-only search over the docs corpus.

Input:
```json
{
  "query": "string",
  "top_k": 8,
  "product_family": "optional string",
  "url_prefix": "optional string",
  "include_snippets": true
}
```

Output:
```json
{
  "results": [
    {
      "id": "chunk-or-doc-id",
      "title": "Apex Developer Guide",
      "url": "https://developer.salesforce.com/...",
      "snippet": "relevant excerpt",
      "score": 0.0,
      "product_family": "apex",
      "section_path": ["Apex Developer Guide", "SOQL", "Relationship Queries"]
    }
  ]
}
```

Behavior:
- hybrid retrieval
- prefer section-level hits, not just whole-page hits
- de-duplicate near-identical results from the same page
- always return canonical URLs

#### 2. `fetch`
Fetch the full normalized content for a result.

Input:
```json
{
  "id": "result id from search"
}
```

Output:
```json
{
  "id": "doc-or-chunk-id",
  "title": "string",
  "text": "full normalized text",
  "url": "canonical URL",
  "metadata": {
    "source_type": "html",
    "product_family": "apex",
    "section_path": ["..."],
    "headings": ["..."],
    "last_crawled_at": "ISO-8601"
  }
}
```

#### 3. `get_related`
Optional but recommended.

Input:
```json
{
  "id": "doc-or-chunk-id",
  "top_k": 5
}
```

Returns semantically related docs or neighboring sections.

#### 4. `stats`
Operational introspection.

Input:
```json
{}
```

Output includes:
- indexed docs count
- indexed chunks count
- last crawl time
- failed pages count
- vector collection size

### Resources (optional)

Expose optional resources later:
- `salesforce-doc://doc/{doc_id}`
- `salesforce-doc://chunk/{chunk_id}`

This is useful for clients that can browse resources, but tools are the priority.

## Compatibility target

Use `search` and `fetch` exactly as the first tool names so the server is also easy to reuse with other OpenAI-compatible MCP flows beyond Codex.

Both tools must be read-only and return stable citation fields:
- `id`
- `title`
- `url`
- `text` for fetch

## Server behavior

### Error handling

Return clear typed errors for:
- invalid arguments
- unknown IDs
- stale index state
- temporary backend failures

### Security

- read-only server
- bearer token auth for hosted mode
- optional OAuth later
- host/origin validation per MCP guidance
- strict CORS allowlist if browser clients are used
- request logging without storing sensitive query data unless explicitly enabled

### Observability

- structured logs
- metrics:
  - query latency
  - embedding latency
  - vector search latency
  - crawl success/failure rate
  - extraction failure rate
- tracing hooks if available

## Data model

### `documents`
- `id`
- `canonical_url` unique
- `raw_url`
- `title`
- `product_family`
- `source_type`
- `full_text`
- `content_hash`
- `http_etag`
- `http_last_modified`
- `status`
- `last_crawled_at`
- `created_at`
- `updated_at`

### `chunks`
- `id`
- `document_id`
- `ordinal`
- `section_path_json`
- `anchor`
- `chunk_text`
- `token_count`
- `content_hash`
- `start_offset`
- `end_offset`

### `crawl_queue`
- `url`
- `priority`
- `status`
- `retry_count`
- `next_attempt_at`
- `last_error`

## Incremental sync

Implement incremental crawling from day one.

Rules:
- re-fetch sitemap files on schedule
- detect added/removed URLs
- skip unchanged pages by content hash or conditional HTTP
- re-embed only changed chunks
- soft-delete removed docs from search results

Recommended cadence:
- nightly full sitemap refresh
- hourly lightweight sitemap poll in production if cheap enough

## Quality requirements

### Search relevance

Create a small evaluation set of 50 to 100 realistic Salesforce queries:
- exact API lookup
- conceptual question
- CLI command
- object/field reference
- troubleshooting/error message
- release/version-specific query

Track:
- Recall@5
- MRR@10
- nDCG@10

### Extraction quality

For sampled pages verify:
- title correctness
- section boundaries
- code block preservation
- URL canonicalization
- duplicate suppression

## Acceptance criteria

1. The hosted server is reachable at a Streamable HTTP MCP endpoint.
2. Codex can add the server by URL and successfully list tools.
3. `search` returns official Salesforce docs URLs and useful snippets for common Salesforce developer queries.
4. `fetch` returns normalized text and metadata for a selected result.
5. The crawler builds the index from Salesforce docs sitemaps without depending on site search pages.
6. The system supports incremental re-crawls.
7. The service is read-only, authenticated in hosted mode, and safe to expose to trusted internal users.
8. Basic relevance evaluation exists and is runnable from CI or a local script.

## Suggested project structure

```text
/apps
  /server
    src/
      index.ts
      mcp/
        tools/
          search.ts
          fetch.ts
          getRelated.ts
          stats.ts
      http/
      auth/
      config/
  /crawler
    src/
      sitemap/
      fetch/
      extract/
      normalize/
      chunk/
      embed/
      index/
/packages
  /shared
    schemas/
    types/
    utils/
  /evals
    queries/
    harness/
```

## Milestones

### Milestone 1 — skeleton MCP
- create Streamable HTTP MCP server
- expose stub `search` and `fetch`
- add auth and config
- verify Codex can connect

### Milestone 2 — crawl + extract
- parse robots + sitemaps
- fetch and normalize HTML
- persist documents and chunks
- support local one-shot indexing

### Milestone 3 — retrieval
- embeddings
- vector index
- lexical index
- hybrid fusion
- real `search`

### Milestone 4 — production hardening
- incremental sync
- retries
- metrics/logging
- tests
- deployment manifests

### Milestone 5 — quality improvements
- reranker
- product-family filters
- neighbor expansion
- PDF handling
- optional browser-render fallback

## Nice-to-have extensions

- release/version awareness
- “latest vs historical” ranking controls
- query rewriting for Salesforce acronyms
- result diversification across guides
- embedded screenshots/images for docs pages that are diagram-heavy
- per-product sub-indexes
- admin UI for crawl/index status

## Direct instruction for Codex

Build this as a production-oriented, read-only remote MCP server for Salesforce docs.

Priorities:
1. make the MCP server connect cleanly from Codex over Streamable HTTP
2. make `search` and `fetch` work end-to-end on a real indexed subset
3. then scale to full sitemap ingestion and hybrid retrieval
4. keep the code modular so vector backend and embedding provider can be swapped later

Implementation constraints:
- prefer TypeScript unless there is a strong reason otherwise
- keep server stateless unless sessions are clearly required
- pin stable SDK/library versions
- use environment variables for secrets
- write tests for extraction, indexing, and search
- include Docker support and a simple deployment target
- include a sample `.codex/config.toml` snippet and a sample `AGENTS.md` instruction
