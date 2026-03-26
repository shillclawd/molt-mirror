import type { MoltbookPost } from "../types.js";

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
  ): Promise<{ id: string }> {
    return this.request<{ id: string }>("/posts", {
      method: "POST",
      body: JSON.stringify({ submolt_name: submolt, title, content }),
    });
  }

  async getPost(id: string): Promise<MoltbookPost> {
    return this.request<MoltbookPost>(`/posts/${id}`);
  }
}
