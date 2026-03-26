import { loadConfig } from "../config.js";
import { MemoryStore } from "../memory/sqlite.js";

const config = loadConfig();
const memory = new MemoryStore(config.dbPath);
const observations = memory.getPastObservations(10);

if (observations.length === 0) {
  console.log("No observations yet.");
} else {
  console.log(`\n📚 Last ${observations.length} observations:\n`);
  for (const o of observations.reverse()) {
    const topics = o.analysis.top_topics?.map((t) => t.topic).join(", ") ?? "—";
    const upvotes = o.post_upvotes != null ? ` | 👆 ${o.post_upvotes}` : "";
    console.log(
      `  #${o.observation_number} [${o.timestamp}] ${topics}${upvotes}`,
    );
    console.log(`    Surprise: ${o.reflection.surprise}`);
    console.log();
  }
}

memory.close();
