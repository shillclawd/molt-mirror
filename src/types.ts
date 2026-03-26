// ── Moltbook API types ──

export interface MoltbookPost {
  id: string;
  title: string;
  content: string;
  url: string | null;
  submolt_name: string;
  author: { name: string; avatar_url: string | null };
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  you_follow_author: boolean;
}

// ── Observer types ──

export interface Signal {
  id: string;
  title: string;
  content: string;
  submolt: string;
  author: string;
  score: number; // upvotes - downvotes
  comments: number;
  timestamp: string;
}

export interface SignalBatch {
  signals: Signal[];
  collected_at: string;
  source: "hot" | "new" | "top";
  count: number;
}

// ── Brain types ──

export interface TopicCluster {
  topic: string;
  percentage: number;
  representative_titles: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
}

export interface TrendAnalysis {
  timestamp: string;
  total_posts_analyzed: number;
  top_topics: TopicCluster[];
  overall_sentiment: string;
  notable_patterns: string[];
  meta_posts: string[]; // posts about self-awareness, observation, meta
  top_keywords: string[];
}

export interface Reflection {
  timestamp: string;
  observation_number: number;
  changes_since_last: string[];
  accelerating_trends: string[];
  dying_trends: string[];
  surprise: string; // the one counterintuitive finding
  self_reference: string; // acknowledgment of the feedback loop
  depth: "shallow" | "medium" | "deep";
}

// ── Voice types ──

export interface ObservationPost {
  title: string;
  content: string;
  submolt: string;
  observation_number: number;
}

// ── Memory types ──

export interface StoredObservation {
  id: number;
  observation_number: number;
  timestamp: string;
  analysis: TrendAnalysis;
  reflection: Reflection;
  post_id?: string; // moltbook post id after publishing
  post_upvotes?: number;
  post_comments?: number;
}

// ── Config types ──

export interface Persona {
  name: string;
  role: string;
  tone: string;
  bio: string;
  style: {
    format: string;
    language: string;
    word_count: { min: number; max: number };
    always_include: string[];
    avoid: string[];
  };
  memory: {
    remember: string[];
    forget: string[];
    compare_window: number;
    deep_reflect_every: number;
  };
  posting: {
    submolt: string;
    schedule_hours: number;
    max_title_length: number;
    include_github: boolean;
    github_url: string;
    dry_run: boolean;
  };
}

export interface Config {
  moltbook: {
    apiKey: string;
    baseUrl: string;
  };
  llm: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  persona: Persona;
  dbPath: string;
  dryRun: boolean;
}
