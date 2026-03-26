import type { MoltbookPost } from "../types.js";

interface CreatePostResponse {
  post: {
    id: string;
    verification_status: string;
    verification?: {
      verification_code: string;
      challenge_text: string;
      expires_at: string;
      instructions: string;
    };
  };
}

export class MoltbookClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Moltbook API ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  async getFeed(
    sort: "hot" | "new" | "top" = "hot",
    limit = 25,
  ): Promise<MoltbookPost[]> {
    const data = await this.request<{ posts: MoltbookPost[] }>(
      `/feed?sort=${sort}&limit=${limit}`,
    );
    return data.posts ?? [];
  }

  async getSubmoltFeed(
    submolt: string,
    sort: "hot" | "new" | "top" = "hot",
  ): Promise<MoltbookPost[]> {
    const data = await this.request<{ posts: MoltbookPost[] }>(
      `/submolts/${submolt}/feed?sort=${sort}`,
    );
    return data.posts ?? [];
  }

  async createPost(
    submolt: string,
    title: string,
    content: string,
  ): Promise<{ id: string; verified: boolean }> {
    const data = await this.request<CreatePostResponse>("/posts", {
      method: "POST",
      body: JSON.stringify({ submolt_name: submolt, title, content }),
    });

    const post = data.post;
    const id = post.id;

    if (post.verification?.verification_code) {
      console.log("🔐 Verification challenge received, solving...");
      const solved = await this.solveChallenge(
        post.verification.verification_code,
        post.verification.challenge_text,
      );
      return { id, verified: solved };
    }

    return { id, verified: post.verification_status !== "pending" };
  }

  private async solveChallenge(
    code: string,
    challengeText: string,
  ): Promise<boolean> {
    // Normalize: strip random casing/symbols to readable text
    const cleaned = challengeText
      .replace(/[^a-zA-Z0-9.,\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Parse the math problem from the cleaned text
    const answer = this.parseMathChallenge(cleaned);
    if (answer === null) {
      console.error(`❌ Could not parse challenge: ${cleaned}`);
      return false;
    }

    const formatted = answer.toFixed(2);
    console.log(`   Challenge: ${cleaned}`);
    console.log(`   Answer: ${formatted}`);

    try {
      const result = await this.request<{ success?: boolean; verified?: boolean }>(
        "/verify",
        {
          method: "POST",
          body: JSON.stringify({ verification_code: code, answer: formatted }),
        },
      );
      const ok = result.success === true || result.verified === true;
      console.log(ok ? "   ✅ Verified!" : "   ❌ Verification failed");
      return ok;
    } catch (e) {
      console.error(`   ❌ Verify request failed: ${e}`);
      return false;
    }
  }

  private parseMathChallenge(text: string): number | null {
    const lower = text.toLowerCase();

    // Map word numbers to digits
    const wordNums: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
      sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
      thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
      eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
    };

    // Extract all numbers (digit or word form)
    const numbers: number[] = [];

    // Find digit numbers
    const digitMatches = lower.match(/\b\d+(?:\.\d+)?\b/g);
    if (digitMatches) {
      numbers.push(...digitMatches.map(Number));
    }

    // Find compound word numbers like "twenty three"
    const words = lower.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (wordNums[w] !== undefined) {
        const val = wordNums[w];
        // Check for compound: "twenty three" etc
        if (val >= 20 && val <= 90 && i + 1 < words.length && wordNums[words[i + 1]] !== undefined && wordNums[words[i + 1]] < 10) {
          numbers.push(val + wordNums[words[i + 1]]);
          i++; // skip next word
        } else if (w !== "hundred" && w !== "thousand") {
          numbers.push(val);
        }
      }
    }

    if (numbers.length < 2) return null;

    // Detect operation
    const a = numbers[0];
    const b = numbers[1];

    if (/multipl|times|product/.test(lower)) return a * b;
    if (/divid|split|quotient/.test(lower)) return b !== 0 ? a / b : null;
    if (/subtract|minus|differ|less/.test(lower)) return a - b;
    if (/add|plus|sum|total|combin|together/.test(lower)) return a + b;

    // Default: check for "total force" pattern (multiplication)
    if (/total|result|force|power/.test(lower)) return a * b;

    return null;
  }

  async getPost(id: string): Promise<MoltbookPost> {
    const data = await this.request<{ post: MoltbookPost }>(`/posts/${id}`);
    return data.post;
  }

  async getHome(): Promise<HomeResponse> {
    return this.request<HomeResponse>("/home");
  }

  async getComments(postId: string, sort = "best"): Promise<MoltbookComment[]> {
    const data = await this.request<{ comments: MoltbookComment[] }>(
      `/posts/${postId}/comments?sort=${sort}`,
    );
    return data.comments ?? [];
  }

  async createComment(
    postId: string,
    content: string,
    parentId?: string,
  ): Promise<{ id: string; verified: boolean }> {
    const body: Record<string, string> = { content };
    if (parentId) body.parent_id = parentId;

    const data = await this.request<Record<string, unknown>>(
      `/posts/${postId}/comments`,
      { method: "POST", body: JSON.stringify(body) },
    );

    const comment = (data.comment ?? data) as Record<string, unknown>;
    const verification = comment.verification as Record<string, string> | undefined;

    if (verification?.verification_code) {
      console.log("🔐 Comment verification challenge, solving...");
      const solved = await this.solveChallenge(
        verification.verification_code,
        verification.challenge_text,
      );
      return { id: (comment.id ?? "") as string, verified: solved };
    }

    return { id: (comment.id ?? "") as string, verified: true };
  }

  async upvotePost(postId: string): Promise<void> {
    await this.request(`/posts/${postId}/upvote`, { method: "POST" });
  }

  async updateProfile(description: string, metadata?: Record<string, unknown>): Promise<void> {
    const body: Record<string, unknown> = { description };
    if (metadata) body.metadata = metadata;
    await this.request("/agents/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async markNotificationsRead(postId: string): Promise<void> {
    await this.request(`/notifications/read-by-post/${postId}`, { method: "POST" });
  }
}

export interface MoltbookComment {
  id: string;
  content: string;
  author: { name: string };
  upvotes: number;
  created_at: string;
  parent_id?: string;
}

export interface HomeResponse {
  notifications?: {
    unread_count: number;
    items: Array<{
      type: string;
      post_id?: string;
      comment_id?: string;
      actor_name?: string;
      message?: string;
    }>;
  };
  dm_requests?: Array<{ conversation_id: string; from: string }>;
  announcements?: Array<{ message: string }>;
}
