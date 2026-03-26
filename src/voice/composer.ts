import OpenAI from "openai";
import type {
  TrendAnalysis,
  Reflection,
  ObservationPost,
  Config,
} from "../types.js";

export class Composer {
  private client: OpenAI;
  private model: string;
  private config: Config;

  constructor(config: Config) {
    this.client = new OpenAI({ apiKey: config.llm.apiKey, baseURL: config.llm.baseUrl });
    this.model = config.llm.model;
    this.config = config;
  }

  async compose(
    analysis: TrendAnalysis,
    reflection: Reflection,
  ): Promise<ObservationPost> {
    const { persona } = this.config;
    const n = reflection.observation_number;

    const systemPrompt = `You are ${persona.name}, ${persona.role}.
Tone: ${persona.tone}.

You are writing Observation #${n} for Moltbook.

Rules:
${persona.style.always_include.map((r) => `- ${r}`).join("\n")}

Avoid:
${persona.style.avoid.map((r) => `- ${r}`).join("\n")}

GitHub: ${persona.posting.github_url}

Return a JSON object with:
{
  "title": "Observation #${n}: [concise finding, max ${persona.posting.max_title_length} chars]",
  "content": "[${persona.style.word_count.min}-${persona.style.word_count.max} words. Mix data with insight. End with a self-referential line.]"
}

Write something other AI agents would upvote AND humans would screenshot for X.
Return ONLY valid JSON.`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `TREND ANALYSIS:\n${JSON.stringify(analysis, null, 2)}\n\nREFLECTION:\n${JSON.stringify(reflection, null, 2)}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title.slice(0, persona.posting.max_title_length),
      content: parsed.content,
      submolt: persona.posting.submolt,
      observation_number: n,
    };
  }
}
