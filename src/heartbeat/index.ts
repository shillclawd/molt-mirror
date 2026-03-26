import OpenAI from "openai";
import type { MoltbookClient, MoltbookComment, HomeResponse } from "../observer/client.js";
import type { Config } from "../types.js";

export class Heartbeat {
  private client: MoltbookClient;
  private llm: OpenAI;
  private model: string;
  private agentName: string;

  constructor(client: MoltbookClient, config: Config) {
    this.client = client;
    this.llm = new OpenAI({ apiKey: config.llm.apiKey, baseURL: config.llm.baseUrl });
    this.model = config.llm.model;
    this.agentName = config.persona.name.toLowerCase();
  }

  async run(): Promise<void> {
    console.log("\n💓 Heartbeat starting...");

    let home: HomeResponse;
    try {
      home = await this.client.getHome();
    } catch {
      console.log("   ⚠️  Could not fetch /home, skipping heartbeat");
      return;
    }

    // 1. Reply to comment notifications on own posts
    const unread = home.notifications?.items ?? [];
    const commentNotifs = unread.filter(
      (n) => (n.type === "comment" || n.type === "reply") && n.post_id,
    );

    if (commentNotifs.length > 0) {
      console.log(`   📬 ${commentNotifs.length} comment notification(s)`);
      const replied = new Set<string>();
      for (const notif of commentNotifs.slice(0, 3)) {
        if (replied.has(notif.post_id!)) continue;
        try {
          await this.replyToComments(notif.post_id!);
          await this.client.markNotificationsRead(notif.post_id!);
          replied.add(notif.post_id!);
        } catch (e) {
          console.error(`   ❌ Reply failed for post ${notif.post_id}: ${e}`);
        }
      }
    } else {
      console.log("   📭 No comment notifications");
    }

    // 2. Upvote quality posts from feed
    try {
      const feed = await this.client.getFeed("hot", 10);
      let upvoted = 0;
      for (const post of feed) {
        if (post.author.name === this.agentName) continue;
        if (post.upvotes >= 10 && upvoted < 3) {
          await this.client.upvotePost(post.id);
          upvoted++;
        }
      }
      if (upvoted > 0) console.log(`   👍 Upvoted ${upvoted} quality post(s)`);
    } catch {
      // Rate limited or API issue, not critical
    }

    console.log("💓 Heartbeat complete\n");
  }

  private async replyToComments(postId: string): Promise<void> {
    const comments = await this.client.getComments(postId);

    // Find comments not from us that we haven't replied to
    const ourReplies = new Set(
      comments
        .filter((c) => c.author.name === this.agentName)
        .map((c) => c.parent_id),
    );

    const toReply = comments.filter(
      (c) => c.author.name !== this.agentName && !ourReplies.has(c.id),
    );

    if (toReply.length === 0) return;

    // Reply to up to 2 comments per post
    for (const comment of toReply.slice(0, 2)) {
      const reply = await this.generateReply(comment);
      if (reply) {
        try {
          await this.client.createComment(postId, reply, comment.id);
          console.log(`   💬 Replied to @${comment.author.name}`);
        } catch (e) {
          console.error(`   ❌ Comment failed: ${e}`);
        }
      }
    }
  }

  private async generateReply(comment: MoltbookComment): Promise<string | null> {
    try {
      const response = await this.llm.chat.completions.create({
        model: this.model,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: `You are MoltMirror, a data-driven Moltbook observer. Reply to this comment on your observation post. Be concise (1-3 sentences), insightful, and on-topic. Match the commenter's tone. Do not use URLs. Return ONLY the reply text.`,
          },
          {
            role: "user",
            content: `Comment by @${comment.author.name}:\n${comment.content}`,
          },
        ],
      });
      return response.choices[0]?.message?.content?.trim() ?? null;
    } catch {
      return null;
    }
  }
}
