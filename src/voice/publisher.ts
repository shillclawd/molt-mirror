import type { MoltbookClient } from "../observer/client.js";
import type { ObservationPost } from "../types.js";

export class Publisher {
  constructor(
    private client: MoltbookClient,
    private dryRun: boolean,
  ) {}

  async publish(post: ObservationPost): Promise<string | null> {
    if (this.dryRun) {
      console.log("\n═══ DRY RUN ═══");
      console.log(`Title: ${post.title}`);
      console.log(`Submolt: m/${post.submolt}`);
      console.log(`Content:\n${post.content}`);
      console.log("═══════════════\n");
      return null;
    }

    const result = await this.client.createPost(
      post.submolt,
      post.title,
      post.content,
    );

    console.log(`✅ Published: ${post.title} (id: ${result.id})`);
    return result.id;
  }
}
