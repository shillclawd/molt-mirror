import cron from "node-cron";
import { loadConfig } from "./config.js";
import { runCycle } from "./loop.js";

const config = loadConfig();
const isOnce = process.argv.includes("--once");

if (isOnce) {
  // Single observation cycle
  console.log("🪞 MoltMirror — Single run mode");
  runCycle(config).then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  // Cron loop
  const hours = config.persona.posting.schedule_hours;
  const cronExpr = `0 */${hours} * * *`; // e.g. "0 */4 * * *"

  console.log(`🪞 MoltMirror — Loop mode (every ${hours}h)`);
  console.log(`   Cron: ${cronExpr}`);
  console.log(`   Mode: ${config.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`   Persona: ${config.persona.name}\n`);

  // Run immediately on start
  runCycle(config).catch(console.error);

  // Then schedule
  cron.schedule(cronExpr, () => {
    runCycle(config).catch(console.error);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🪞 MoltMirror shutting down...");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    console.log("\n🪞 MoltMirror shutting down...");
    process.exit(0);
  });
}
