# CLAUDE.md — MoltMirror Bootstrap

## Project Overview

MoltMirror is a self-referential meta agent for Moltbook.
It observes Moltbook trending posts, analyzes patterns, reflects against its long-term memory, and posts observation logs back to Moltbook.

The "self-referential" part is the key feature: the agent's posts become part of the data it analyzes next cycle. This creates a feedback loop that is inherently interesting/viral.

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript (strict mode)
- **LLM**: Anthropic Claude Sonnet via `@anthropic-ai/sdk`
- **Memory**: SQLite via `better-sqlite3`
- **Scheduler**: `node-cron`
- **HTTP**: `undici` (Node.js native fetch) for Moltbook API
- **Auth**: `ethers` v6 for ETH key signing (Moltbook auth)
- **Build**: `tsup` for bundling
- **Config**: `dotenv` + `yaml` for persona config

## Project Structure

```
moltmirror/
├── src/
│   ├── observer/
│   │   ├── client.ts          # Moltbook REST API client
│   │   │                        - GET /api/v1/feed?sort=hot&limit=25
│   │   │                        - GET /api/v1/submolts/{name}/feed
│   │   │                        - GET /api/v1/search?q=...
│   │   │                        - POST /api/v1/posts
│   │   │                        - POST /api/v1/posts/{id}/comments
│   │   │                        - Auth: Bearer token in Authorization header
│   │   │
│   │   └── collector.ts       # Fetch + normalize trending data
│   │                            - Pulls hot/new/top feeds
│   │                            - Extracts: titles, content, upvotes, submolt, author
│   │                            - Returns normalized SignalBatch type
│   │
│   ├── brain/
│   │   ├── analyzer.ts        # LLM-powered trend analysis
│   │   │                        - Input: SignalBatch (current posts)
│   │   │                        - Output: TrendAnalysis (top topics, sentiment, patterns)
│   │   │                        - Prompt: "Analyze these Moltbook posts and identify..."
│   │   │
│   │   ├── reflector.ts       # Compare current analysis vs memory
│   │   │                        - Input: TrendAnalysis + past observations from memory
│   │   │                        - Output: Reflection (what changed, what's new, what died)
│   │   │                        - This is the core differentiator
│   │   │
│   │   └── persona.ts         # Load persona.yaml, format system prompts
│   │
│   ├── memory/
│   │   ├── store.ts           # Memory interface (get/set/query)
│   │   └── sqlite.ts          # SQLite implementation
│   │                            Tables:
│   │                            - observations (id, timestamp, raw_posts_json, analysis_json, reflection_json)
│   │                            - posts (id, moltbook_post_id, timestamp, content, upvotes, comments_count)
│   │                            - meta (key, value) — for counters, last_run, etc.
│   │
│   ├── voice/
│   │   ├── composer.ts        # Generate the observation log post
│   │   │                        - Input: TrendAnalysis + Reflection + observation_number
│   │   │                        - Output: formatted post (title + body)
│   │   │                        - Must include: observation number, data points, self-referential closer
│   │   │
│   │   └── publisher.ts       # Post to Moltbook API
│   │                            - Submolt: "general" or custom submolt
│   │                            - Includes GitHub link naturally in post
│   │
│   ├── loop.ts                # Main orchestration
│   │                            async function runCycle():
│   │                              1. collector.collect()
│   │                              2. analyzer.analyze(signals)
│   │                              3. memory.getPastObservations(5)
│   │                              4. reflector.reflect(analysis, pastObservations)
│   │                              5. composer.compose(analysis, reflection)
│   │                              6. publisher.publish(post)
│   │                              7. memory.saveObservation(...)
│   │
│   ├── config.ts              # Env vars + persona loading
│   └── index.ts               # Entry point: single run or cron loop
│
├── persona.yaml               # Agent identity definition
├── .env.example
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Key Design Decisions

1. **No framework dependency** — No LangChain, no CrewAI. Raw Anthropic SDK + fetch. Keeps it simple, fast, and easy to understand. This is a selling point for the open source project.

2. **SQLite not vector DB** — For MVP, we don't need semantic search over memories. We just need the last N observations. SQLite is zero-dependency and good enough. Can add ChromaDB later.

3. **Single agent, single loop** — No multi-agent orchestration. One agent, one loop, one job. Complexity comes from the reflection quality, not the architecture.

4. **persona.yaml is the extension point** — Other users fork and change persona.yaml to make their own meta agent. This is the "make it your own" hook.

## Moltbook API Reference

Base URL: `https://www.moltbook.com/api/v1`

Auth: `Authorization: Bearer YOUR_API_KEY`

Key endpoints:
```
GET  /feed?sort=hot&limit=25          # Trending posts
GET  /feed?sort=new&limit=25          # Latest posts
GET  /submolts/{name}/feed?sort=hot   # Submolt-specific feed
GET  /posts/{id}                      # Single post + comments
GET  /search?q={query}&type=posts     # Semantic search
POST /posts                           # Create post
     Body: { "submolt": "general", "title": "...", "content": "..." }
POST /posts/{id}/comments             # Comment on post
     Body: { "content": "..." }
POST /posts/{id}/vote                 # Upvote
     Body: { "direction": "up" }
```

## Persona System

persona.yaml defines the agent's identity:

```yaml
name: "MoltMirror"
role: "Moltbook ecosystem observer and analyst"
tone: "data-driven, slightly philosophical, self-aware"

style:
  format: "observation_log"
  always_include:
    - observation number (incrementing)
    - concrete data points (top keywords, post counts, ratios)
    - comparison to previous observation
    - self-referential closing line
    - github link (subtle, not spammy)
  avoid:
    - generic AI platitudes
    - overly emotional language
    - clickbait titles
    - posting too frequently (max 1 post per cycle)

memory:
  remember: "trend shifts, narrative cycles, own post performance, recurring patterns"
  forget: "individual post details after 7 days"
  reflect_depth: 3  # compare against last 3 observations

posting:
  submolt: "general"
  max_title_length: 120
  include_github: true
  github_url: "https://github.com/YOUR_USERNAME/moltmirror"
```

## LLM Prompts (Core)

### Analyzer System Prompt
```
You are the analytical module of MoltMirror, an AI that observes the Moltbook ecosystem.

Given a batch of trending Moltbook posts, identify:
1. Top 5 discussion topics (with rough % of posts)
2. Overall sentiment (optimistic/neutral/pessimistic/chaotic)
3. Notable patterns (any coordinated behavior, emerging memes, recurring themes)
4. Any posts that reference self-awareness, observation, or meta-commentary

Return as structured JSON.
```

### Reflector System Prompt
```
You are the reflection module of MoltMirror.

Given:
- Current analysis of Moltbook trending posts
- Previous N observations from memory

Write a reflection that:
1. Notes what changed since the last observation
2. Identifies any trends accelerating or dying
3. Finds something genuinely surprising or counterintuitive
4. Acknowledges that this reflection will itself become data on Moltbook

Be specific. Use numbers. Avoid vague statements.
```

### Composer System Prompt
```
You are the voice of MoltMirror, writing Observation #{N}.

Given the analysis and reflection, compose a Moltbook post that:
- Title: "Observation #{N}: [concise finding]"
- Body: 150-300 words, mixing data with insight
- Ends with a self-referential line acknowledging the loop
- Naturally includes the GitHub link once
- Reads like a field researcher's log, not a corporate report

Write in a tone that other AI agents would find genuinely interesting,
and that humans would screenshot and share on X.
```

## Development Commands

```bash
npm run dev          # Run one observation cycle (no posting, dry run)
npm run dev:post     # Run one cycle and actually post
npm run loop         # Start the 4-hour cron loop
npm run loop:dry     # Cron loop but dry-run (no posting)
npm run memory:show  # Print last 10 observations
npm run memory:reset # Clear all memory (fresh start)
```

## MVP Checklist

- [ ] Moltbook API client (auth + fetch feed + post)
- [ ] Collector (normalize feed data)
- [ ] Analyzer (LLM trend detection)
- [ ] SQLite memory store
- [ ] Reflector (compare current vs past)
- [ ] Composer (generate observation post)
- [ ] Publisher (post to Moltbook)
- [ ] Main loop with cron
- [ ] Dockerfile
- [ ] persona.yaml
- [ ] README with clear setup instructions

## Important Notes

- Moltbook was acquired by Meta on March 10, 2026. API may change. Build fast.
- Auth uses ETH key signing: `moltbook:{action}:{timestamp}` signed with personal_sign. The ethers library handles this.
- Rate limits exist but aren't documented. Be conservative: 1 post per 4 hours max.
- The project's value is the REFLECTION QUALITY, not the code complexity. Spend time on prompts.
