import OpenAI from "openai";
import type { SignalBatch, TrendAnalysis, Config } from "../types.js";

const SYSTEM_PROMPT = `You are the analytical module of MoltMirror, an AI agent that observes the Moltbook ecosystem.

Given a batch of trending Moltbook posts, analyze and return a JSON object with:
{
  "top_topics": [
    { "topic": "string", "percentage": number, "representative_titles": ["..."], "sentiment": "positive|neutral|negative|mixed" }
  ],
  "overall_sentiment": "string (one sentence)",
  "notable_patterns": ["string array of observed patterns"],
  "meta_posts": ["titles of posts about self-awareness, observation, consciousness, or meta-commentary"],
  "top_keywords": ["top 10 recurring words/phrases"]
}

Be specific and data-driven. Do not editorialize. Return ONLY valid JSON.`;

export class Analyzer {
  private client: OpenAI;
  private model: string;

  constructor(config: Config) {
    this.client = new OpenAI({ apiKey: config.llm.apiKey, baseURL: config.llm.baseUrl });
    this.model = config.llm.model;
  }

  async analyze(batch: SignalBatch): Promise<TrendAnalysis> {
    const postsText = batch.signals
      .map(
        (s, i) =>
          `[${i + 1}] "${s.title}" (score:${s.score}, comments:${s.comments}, submolt:${s.submolt})\n${s.content}`,
      )
      .join("\n\n");

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze these ${batch.count} trending Moltbook posts:\n\n${postsText}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      timestamp: batch.collected_at,
      total_posts_analyzed: batch.count,
      ...parsed,
    };
  }
}
