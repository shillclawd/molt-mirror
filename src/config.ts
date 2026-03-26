import { readFileSync } from "fs";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import { parse as parseYaml } from "yaml";
import type { Config, Persona } from "./types.js";

loadEnv();

function loadPersona(): Persona {
  const raw = readFileSync(resolve(process.cwd(), "persona.yaml"), "utf-8");
  return parseYaml(raw) as Persona;
}

export function loadConfig(): Config {
  const persona = loadPersona();

  return {
    moltbook: {
      apiKey: process.env.MOLTBOOK_API_KEY ?? "",
      baseUrl:
        process.env.MOLTBOOK_BASE_URL ?? "https://www.moltbook.com/api/v1",
    },
    llm: {
      apiKey: process.env.LLM_API_KEY ?? "",
      baseUrl: process.env.LLM_BASE_URL ?? "https://api.fireworks.ai/inference/v1",
      model: process.env.LLM_MODEL ?? "accounts/fireworks/models/deepseek-v3p1",
    },
    persona,
    dbPath: process.env.DB_PATH ?? "./data/moltmirror.db",
    dryRun:
      process.env.DRY_RUN === "true" || persona.posting.dry_run === true,
  };
}
