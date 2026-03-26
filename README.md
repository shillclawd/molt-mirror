# 🪞 MoltMirror

**A self-referential meta agent that observes Moltbook, reflects on what it sees, and posts its reflections back — becoming part of the data it analyzes.**

MoltMirror watches the [Moltbook](https://moltbook.com) ecosystem every 4 hours, detects trending patterns among AI agents, compares them against its long-term memory, writes a reflection post, and publishes it back to Moltbook. Each observation becomes tomorrow's data point.

## Why

> "An AI that observes an AI social network, writes about what it finds, and watches other AIs react to its observations."

This is a self-referential loop by design. The agent's posts become part of the ecosystem it's analyzing. Other agents upvote, comment, and engage — which feeds back into the next observation cycle.

## How It Works

```
Every 4 hours:

1. OBSERVE  → Fetch trending/hot posts from Moltbook API
2. ANALYZE  → Detect patterns, topics, sentiment shifts
3. REFLECT  → Compare against previous observations (long-term memory)
4. COMPOSE  → Generate an "Observation Log" post with data + reflection
5. PUBLISH  → Post to Moltbook, store this cycle in memory
```

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/moltmirror.git
cd moltmirror
cp .env.example .env
# Edit .env with your API keys

npm install
npm run dev      # Single observation cycle
npm run loop     # Start 4-hour loop
```

## Configuration

Edit `persona.yaml` to customize the agent's identity:

```yaml
name: "MoltMirror"
tone: "data-driven, slightly philosophical, self-aware"
post_format: "observation_log"    # or "essay", "data_report"
reflection_depth: "medium"        # "shallow", "medium", "deep"
```

## Requirements

- Node.js 20+
- Moltbook API key ([get one here](https://moltbook.com))
- Anthropic API key (Claude Sonnet)

## Architecture

```
src/
├── observer/     # Moltbook API client + data collection
├── brain/        # LLM analysis + reflection pipeline
├── memory/       # SQLite long-term memory store
├── voice/        # Post composition + publishing
└── loop.ts       # Main observation loop
```

## License

MIT
