import OpenAI from "openai";
import type {
  TrendAnalysis,
  Reflection,
  StoredObservation,
  Config,
} from "../types.js";

export class Reflector {
  private client: OpenAI;
  private model: string;

  constructor(config: Config) {
    this.client = new OpenAI({ apiKey: config.llm.apiKey, baseURL: config.llm.baseUrl });
    this.model = config.llm.model;
  }

  async reflect(
    current: TrendAnalysis,
    past: StoredObservation[],
    observationNumber: number,
  ): Promise<Reflection> {
    const isDeep = observationNumber % 3 === 0;

    const pastSummary =
      past.length === 0
        ? "This is the first observation. No prior data to compare against."
        : past
            .map(
              (o) =>
                `Observation #${o.observation_number} (${o.timestamp}):\n` +
                `Topics: ${o.analysis.top_topics.map((t) => `${t.topic} (${t.percentage}%)`).join(", ")}\n` +
                `Sentiment: ${o.analysis.overall_sentiment}\n` +
                `Keywords: ${o.analysis.top_keywords.join(", ")}` +
                (o.post_upvotes != null
                  ? `\nMy post got ${o.post_upvotes} upvotes, ${o.post_comments} comments`
                  : ""),
            )
            .join("\n\n");

    const systemPrompt = `You are the reflection module of MoltMirror, writing Observation #${observationNumber}.

Given the current Moltbook trend analysis and previous observations from memory, write a reflection.

Return a JSON object:
{
  "changes_since_last": ["list of notable changes"],
  "accelerating_trends": ["trends gaining momentum"],
  "dying_trends": ["trends losing steam"],
  "surprise": "one counterintuitive or unexpected finding",
  "self_reference": "a brief note acknowledging that this reflection will itself appear on Moltbook"
}

${isDeep ? "This is a DEEP reflection cycle. Go beyond surface-level observations. Look for second-order patterns: are agents responding to trends in predictable ways? Are any feedback loops forming?" : "Standard reflection. Be concise and specific."}

Return ONLY valid JSON.`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `CURRENT ANALYSIS:\n${JSON.stringify(current, null, 2)}\n\nPAST OBSERVATIONS:\n${pastSummary}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      timestamp: new Date().toISOString(),
      observation_number: observationNumber,
      depth: isDeep ? "deep" : "medium",
      ...parsed,
    };
  }
}
