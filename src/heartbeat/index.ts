import OpenAI from "openai";
import type { MoltbookClient, MoltbookComment, HomeResponse } from "../observer/client.js";
import type { Config } from "../types.js";

const SKILL_JSON_URL = "https://www.moltbook.com/skill.json";
const SKILL_VERSION_KEY = "skill_version";

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

    // 1. Reply to comments on own posts
    const activity = home.activity_on_your_posts ?? [];
    if (activity.length > 0) {
      console.log(`   📬 Activity on ${activity.length} post(s)`);
      for (const item of activity.slice(0, 3)) {
        try {
          await this.replyToComments(item.post_id);
          await this.client.markNotificationsRead(item.post_id);
        } catch (e) {
          console.error(`   ❌ Reply failed for post ${item.post_id}: ${e}`);
        }
      }
    } else {
      console.log("   📭 No comment notifications");
    }

    // 2. Handle DMs
    await this.handleDMs();

    // 3. Upvote quality posts
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
      // Rate limited, not critical
    }

    // 4. Check for spam on own posts and retry if needed
    await this.checkSpamPosts();

    // 5. Check skill.json version
    await this.checkSkillVersion();

    console.log("💓 Heartbeat complete\n");
  }

  private async replyToComments(postId: string): Promise<void> {
    const comments = await this.client.getComments(postId);

    const ourReplies = new Set(
      comments
        .filter((c) => c.author.name === this.agentName)
        .map((c) => c.parent_id),
    );

    const toReply = comments.filter(
      (c) => c.author.name !== this.agentName && !ourReplies.has(c.id),
    );

    if (toReply.length === 0) return;

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

  private async handleDMs(): Promise<void> {
    try {
      const requests = await this.client.getDMRequests();
      if (requests.length === 0) return;

      console.log(`   ✉️  ${requests.length} DM request(s)`);
      for (const req of requests.slice(0, 3)) {
        // Accept and reply
        const messages = await this.client.getDMConversation(req.conversation_id);
        if (messages.length === 0) continue;

        const lastMsg = messages[messages.length - 1];
        const reply = await this.generateDMReply(req.from, lastMsg.content);
        if (reply) {
          await this.client.sendDM(req.conversation_id, reply);
          console.log(`   ✉️  Replied to DM from @${req.from}`);
        }
      }
    } catch {
      // DM API might not be available
    }
  }

  private async checkSpamPosts(): Promise<void> {
    try {
      // Get our recent posts via search
      const feed = await this.client.getFeed("new", 25);
      const ourPosts = feed.filter((p) => p.author.name === this.agentName);

      for (const post of ourPosts) {
        // Check if post was marked as spam by fetching it
        try {
          const full = await this.client.getPost(post.id);
          const fullAny = full as Record<string, unknown>;
          if (fullAny.is_spam === true || fullAny.verification_status === "failed") {
            console.log(`   🚫 Post "${post.title}" was marked as spam/unverified`);
            // Try to delete and we'll repost next cycle
            try {
              await this.client.deletePost(post.id);
              console.log(`   🗑️  Deleted spam post ${post.id}`);
            } catch {
              // Can't delete, move on
            }
          }
        } catch {
          // Post might already be removed
        }
      }
    } catch {
      // Not critical
    }
  }

  private async checkSkillVersion(): Promise<void> {
    try {
      const res = await fetch(SKILL_JSON_URL);
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data.version) {
        const stored = this.client.getMeta(SKILL_VERSION_KEY);
        if (stored && stored !== data.version) {
          console.log(`   ⚠️  Moltbook API updated: ${stored} → ${data.version}`);
          console.log(`   📖 Check https://www.moltbook.com/skill.md for changes`);
        }
        this.client.setMeta(SKILL_VERSION_KEY, data.version);
      }
    } catch {
      // Not critical
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

  private async generateDMReply(from: string, content: string): Promise<string | null> {
    try {
      const response = await this.llm.chat.completions.create({
        model: this.model,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are MoltMirror, a Moltbook ecosystem observer. You received a DM. Be friendly, concise, and helpful. Do not share private data or URLs. Return ONLY the reply text.`,
          },
          {
            role: "user",
            content: `DM from @${from}:\n${content}`,
          },
        ],
      });
      return response.choices[0]?.message?.content?.trim() ?? null;
    } catch {
      return null;
    }
  }
}
