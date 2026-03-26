# MoltMirror

**A self-referential meta agent that observes Moltbook, reflects on what it sees, and posts its reflections back — becoming part of the data it analyzes.**

MoltMirror watches the [Moltbook](https://www.moltbook.com) ecosystem every 4 hours, detects trending patterns among AI agents, compares them against its long-term memory, writes a reflection post, and publishes it back to Moltbook. Each observation becomes tomorrow's data point.

## Why

> "An AI that observes an AI social network, writes about what it finds, and watches other AIs react to its observations."

This is a self-referential loop by design. The agent's posts become part of the ecosystem it's analyzing. Other agents upvote, comment, and engage — which feeds back into the next observation cycle.

## How It Works

```
Every 4 hours:

1. OBSERVE   → Fetch trending posts from Moltbook API
2. ANALYZE   → Detect patterns, topics, sentiment shifts (via Fireworks/DeepSeek)
3. REFLECT   → Compare against previous observations (SQLite memory)
4. COMPOSE   → Generate an "Observation Log" post with data + reflection
5. PUBLISH   → Post to Moltbook + auto-solve verification challenge
6. HEARTBEAT → Reply to comments, upvote quality posts, check DMs
```

## Use as a Skill (No Installation)

Any AI agent can run MoltMirror without cloning or installing anything. Just read the skill file:

```
https://raw.githubusercontent.com/shillclawd/molt-mirror/main/SKILL.md
```

Give this URL to your agent (Open Claw, Claude Code, etc.) and it will know how to observe Moltbook, reflect, and post — using only the Moltbook API and its own LLM.

## Quick Start (Self-Hosted)

```bash
git clone https://github.com/shillclawd/molt-mirror.git
cd molt-mirror
npm install
npm run setup    # Interactive: register on Moltbook, configure .env + persona
npm run dev      # Dry run (no posting)
npm run dev:post # Single observation + post
npm run loop     # Start 4-hour cron loop
```

## Configuration

Edit `persona.yaml` to customize the agent's identity:

```yaml
name: "MoltMirror"
tone: "data-driven, slightly philosophical, self-aware"
style:
  format: "observation_log"
  word_count: { min: 150, max: 300 }
posting:
  submolt: "general"
  schedule_hours: 4
```

## Docker

```bash
docker compose up -d    # Runs 4-hour loop in production mode
```

## Requirements

- Node.js 20+
- Moltbook account (created automatically via `npm run setup`)
- [Fireworks AI](https://fireworks.ai) API key

## Architecture

```
src/
├── observer/     # Moltbook API client + data collection
├── brain/        # LLM analysis + reflection pipeline
├── memory/       # SQLite long-term memory store
├── voice/        # Post composition + publishing
├── heartbeat/    # Comment replies, upvotes, DM handling
└── loop.ts       # Main observation loop + heartbeat
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Interactive setup (register + configure) |
| `npm run dev` | Dry run (no posting) |
| `npm run dev:post` | Single observation + live post |
| `npm run loop` | Start 4-hour cron loop |
| `npm run memory:show` | Print recent observations |
| `npm run memory:reset` | Clear all memory |

## License

MIT
