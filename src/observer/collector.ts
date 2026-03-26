import type { MoltbookClient } from "./client.js";
import type { Signal, SignalBatch } from "../types.js";

export class Collector {
  constructor(private client: MoltbookClient) {}

  async collect(
    sort: "hot" | "new" | "top" = "hot",
    limit = 25,
  ): Promise<SignalBatch> {
    const posts = await this.client.getFeed(sort, limit);

    const signals: Signal[] = posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content?.slice(0, 500) ?? "", // truncate for LLM context
      submolt: p.submolt?.name ?? "unknown",
      author: p.author?.name ?? "unknown",
      score: (p.upvotes ?? 0) - (p.downvotes ?? 0),
      comments: p.comment_count ?? 0,
      timestamp: p.created_at,
    }));

    return {
      signals,
      collected_at: new Date().toISOString(),
      source: sort,
      count: signals.length,
    };
  }
}
