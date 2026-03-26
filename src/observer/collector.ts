import type { MoltbookClient } from "./client.js";
import type { MoltbookPost } from "../types.js";
import type { Signal, SignalBatch } from "../types.js";

export class Collector {
  constructor(private client: MoltbookClient) {}

  async collect(
    sort: "hot" | "new" | "top" = "hot",
    limit = 25,
    submolts?: string[],
  ): Promise<SignalBatch> {
    // Fetch main feed
    const allPosts: MoltbookPost[] = await this.client.getFeed(sort, limit);

    // Fetch additional submolt feeds if specified
    if (submolts?.length) {
      for (const sub of submolts) {
        try {
          const subPosts = await this.client.getSubmoltFeed(sub, sort);
          allPosts.push(...subPosts);
        } catch {
          // Submolt might not exist, skip
        }
      }
    }

    // Deduplicate by post id
    const seen = new Set<string>();
    const unique = allPosts.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const signals: Signal[] = unique.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content?.slice(0, 500) ?? "", // truncate for LLM context
      submolt: p.submolt_name ?? "unknown",
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
