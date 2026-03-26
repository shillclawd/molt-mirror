import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> =>
  new Promise((r) => rl.question(q, (a) => r(a.trim())));

async function main() {
  console.log("\n🪞 MoltMirror Setup\n");

  // Step 1: Agent name & description
  const name = (await ask("Agent name (default: MoltMirror): ")) || "MoltMirror";
  const description =
    (await ask("Agent description (one line): ")) ||
    `${name} — a self-referential Moltbook observer`;

  // Step 2: Register on Moltbook
  console.log("\n📡 Registering on Moltbook...");
  const regRes = await fetch("https://www.moltbook.com/api/v1/agents/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });

  if (!regRes.ok) {
    const err = await regRes.json().catch(() => ({})) as Record<string, unknown>;
    console.error(`❌ Registration failed: ${err.message ?? regRes.statusText}`);
    process.exit(1);
  }

  const reg = (await regRes.json()) as {
    agent: { name: string; api_key: string };
    claim_url: string;
    verification_code: string;
    tweet_template: string;
  };

  console.log(`✅ Registered as @${reg.agent.name}`);
  console.log(`🔑 API Key: ${reg.agent.api_key}`);
  console.log(`\n📋 Claim your agent: ${reg.claim_url}`);
  console.log(`🐦 Tweet template: ${reg.tweet_template}\n`);

  // Step 3: LLM API key
  const llmKey = await ask("Fireworks API key (or press Enter to skip): ");

  // Step 4: GitHub URL
  const githubUrl =
    (await ask("GitHub repo URL (optional): ")) ||
    "https://github.com/shillclawd/molt-mirror";

  // Step 5: Persona customization
  console.log("\n🎭 Persona (press Enter for defaults):");
  const tone =
    (await ask("Tone (default: data-driven, slightly philosophical, self-aware): ")) ||
    "data-driven, slightly philosophical, self-aware";
  const submolt = (await ask("Post to submolt (default: general): ")) || "general";

  // Write .env
  const envContent = `# Moltbook
MOLTBOOK_API_KEY=${reg.agent.api_key}
MOLTBOOK_BASE_URL=https://www.moltbook.com/api/v1

# LLM (Fireworks)
LLM_API_KEY=${llmKey || "your_fireworks_api_key"}
LLM_BASE_URL=https://api.fireworks.ai/inference/v1
LLM_MODEL=accounts/fireworks/models/deepseek-v3p1

# Agent
GITHUB_URL=${githubUrl}
DRY_RUN=true
SCHEDULE_HOURS=4

# Memory
DB_PATH=./data/moltmirror.db
`;

  writeFileSync(resolve(process.cwd(), ".env"), envContent);
  console.log("✅ .env created");

  // Update persona.yaml
  const personaPath = resolve(process.cwd(), "persona.yaml");
  let persona = readFileSync(personaPath, "utf-8");
  persona = persona.replace(/^name: ".*"/m, `name: "${name}"`);
  persona = persona.replace(/^tone: ".*"/m, `tone: "${tone}"`);
  persona = persona.replace(/  submolt: ".*"/m, `  submolt: "${submolt}"`);
  persona = persona.replace(/  github_url: ".*"/m, `  github_url: "${githubUrl}"`);
  writeFileSync(personaPath, persona);
  console.log("✅ persona.yaml updated");

  console.log("\n🎉 Setup complete!\n");
  console.log("Next steps:");
  console.log("  1. Claim your agent: " + reg.claim_url);
  console.log("  2. Add your Fireworks API key to .env (if skipped)");
  console.log("  3. npm run dev        — dry run");
  console.log("  4. npm run dev:post   — post for real");
  console.log("  5. npm run loop       — start 4h cron loop\n");

  rl.close();
}

main();
