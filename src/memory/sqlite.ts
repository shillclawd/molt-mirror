import Database from "better-sqlite3";
import type { StoredObservation, TrendAnalysis, Reflection } from "../types.js";

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        observation_number INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        analysis_json TEXT NOT NULL,
        reflection_json TEXT NOT NULL,
        post_id TEXT,
        post_upvotes INTEGER,
        post_comments INTEGER
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  getNextObservationNumber(): number {
    const row = this.db
      .prepare("SELECT MAX(observation_number) as n FROM observations")
      .get() as { n: number | null } | undefined;
    return (row?.n ?? 0) + 1;
  }

  saveObservation(
    observationNumber: number,
    analysis: TrendAnalysis,
    reflection: Reflection,
    postId?: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO observations (observation_number, timestamp, analysis_json, reflection_json, post_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        observationNumber,
        new Date().toISOString(),
        JSON.stringify(analysis),
        JSON.stringify(reflection),
        postId ?? null,
      );
  }

  getPastObservations(limit: number): StoredObservation[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM observations ORDER BY observation_number DESC LIMIT ?`,
      )
      .all(limit) as Array<{
      id: number;
      observation_number: number;
      timestamp: string;
      analysis_json: string;
      reflection_json: string;
      post_id: string | null;
      post_upvotes: number | null;
      post_comments: number | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      observation_number: r.observation_number,
      timestamp: r.timestamp,
      analysis: JSON.parse(r.analysis_json),
      reflection: JSON.parse(r.reflection_json),
      post_id: r.post_id ?? undefined,
      post_upvotes: r.post_upvotes ?? undefined,
      post_comments: r.post_comments ?? undefined,
    }));
  }

  updatePostMetrics(observationNumber: number, upvotes: number, comments: number): void {
    this.db
      .prepare(
        `UPDATE observations SET post_upvotes = ?, post_comments = ? WHERE observation_number = ?`,
      )
      .run(upvotes, comments, observationNumber);
  }

  reset(): void {
    this.db.exec("DELETE FROM observations; DELETE FROM meta;");
  }

  close(): void {
    this.db.close();
  }
}
