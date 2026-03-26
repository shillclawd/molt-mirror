import type { Config } from "./types.js";
import { MoltbookClient } from "./observer/client.js";
import { Collector } from "./observer/collector.js";
import { Analyzer } from "./brain/analyzer.js";
import { Reflector } from "./brain/reflector.js";
import { MemoryStore } from "./memory/sqlite.js";
import { Composer } from "./voice/composer.js";
import { Publisher } from "./voice/publisher.js";
import { Heartbeat } from "./heartbeat/index.js";

export async function runCycle(config: Config): Promise<void> {
  const startTime = Date.now();

  // ── Init ──
  const moltbook = new MoltbookClient(config.moltbook.baseUrl, config.moltbook.apiKey);
  const collector = new Collector(moltbook);
  const analyzer = new Analyzer(config);
  const reflector = new Reflector(config);
  const memory = new MemoryStore(config.dbPath);
  const composer = new Composer(config);
  const publisher = new Publisher(moltbook, config.dryRun);

  const observationNumber = memory.getNextObservationNumber();

  console.log(`\n🪞 MoltMirror — Observation #${observationNumber}`);
  console.log(`   ${new Date().toISOString()}`);
  console.log(`   Mode: ${config.dryRun ? "DRY RUN" : "LIVE"}\n`);

  try {
    // ── 1. OBSERVE ──
    console.log("👁  Collecting trending posts...");
    const submolts = config.persona.observe_submolts ?? [];
    const batch = await collector.collect("hot", 25, submolts.length > 0 ? submolts : undefined);
    console.log(`   Collected ${batch.count} posts`);

    if (batch.count === 0) {
      console.log("⚠️  No posts found. Skipping cycle.");
      memory.close();
      return;
    }

    // ── 2. ANALYZE ──
    console.log("🧠 Analyzing trends...");
    const analysis = await analyzer.analyze(batch);
    console.log(
      `   Top topics: ${analysis.top_topics?.map((t) => t.topic).join(", ") ?? "none"}`,
    );

    // ── 3. RECALL ──
    const pastObservations = memory.getPastObservations(
      config.persona.memory.compare_window,
    );
    console.log(`📚 Loaded ${pastObservations.length} past observations`);

    // ── Update metrics of previous post ──
    if (pastObservations.length > 0 && pastObservations[0].post_id) {
      try {
        const prevPost = await moltbook.getPost(pastObservations[0].post_id);
        memory.updatePostMetrics(
          pastObservations[0].observation_number,
          (prevPost.upvotes ?? 0) - (prevPost.downvotes ?? 0),
          prevPost.comment_count ?? 0,
        );
        console.log(
          `   Updated Observation #${pastObservations[0].observation_number} metrics: ${prevPost.upvotes} upvotes`,
        );
      } catch {
        // Post might be deleted or API changed, ignore
      }
    }

    // ── 4. REFLECT ──
    console.log("💭 Reflecting...");
    const reflection = await reflector.reflect(
      analysis,
      pastObservations,
      observationNumber,
    );
    console.log(`   Depth: ${reflection.depth}`);
    console.log(`   Surprise: ${reflection.surprise}`);

    // ── 5. COMPOSE ──
    console.log("✍️  Composing observation post...");
    const post = await composer.compose(analysis, reflection);

    // ── 6. PUBLISH ──
    console.log("📤 Publishing...");
    const postId = await publisher.publish(post);

    // ── 7. REMEMBER ──
    memory.saveObservation(observationNumber, analysis, reflection, postId ?? undefined);
    console.log("💾 Saved to memory");

    // ── 8. HEARTBEAT ──
    const heartbeat = new Heartbeat(moltbook, config);
    await heartbeat.run();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Observation #${observationNumber} complete (${elapsed}s)\n`);
  } catch (err) {
    console.error(`\n❌ Observation #${observationNumber} failed:`, err);
  } finally {
    memory.close();
  }
}
