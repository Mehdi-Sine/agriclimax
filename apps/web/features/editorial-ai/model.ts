import type { EditorialBriefingBundle } from "../editorial/briefing";
import type { JournalMapData } from "../journal/ui/map-data";
export const ENGINE = "editorial-ai-1";
export const PROMPT_VERSION = "editorial-board-fr-1";
export const CONFIG_VERSION = "editorial-config-1";
export interface Block {
  text: string;
  evidence_ids: string[];
  seasonal_ids: string[];
  kind: "fact" | "context" | "question" | "limitation";
}
export interface Figure {
  fact_id: string;
  value: number;
  unit: string;
  period: string[];
  region: string | null;
  pra_id: string | null;
  nature: "forecast" | "reanalysis" | "descriptive";
  scope: "pra" | "regional_sample" | "national_sample";
}
export interface EditorialDraft {
  version: "editorial-draft-1";
  bundle_id: string;
  edition_date: string;
  main_candidate_id: string | null;
  decision: Block;
  alternatives: { candidate_id: string; reason: Block }[];
  secondary_candidate_ids: string[];
  headline: Block;
  lead: Block;
  article: Block[];
  key_figures: Figure[];
  regions: { region: string; blocks: Block[] }[];
  productions: { production_id: string; blocks: Block[] }[];
  news_ids: string[];
  illustration_ids: string[];
  limitations: Block[];
}
export interface Illustration {
  id: string;
  caption: string;
  phenomenon: string;
  period: [string, string];
  cycle: string;
  evidence_ids: string[];
  data: JournalMapData;
  sha256: string;
}
export interface Validation {
  status: "rejected" | "needs_editorial_review" | "validated_automatically";
  errors: string[];
  review: string[];
}
export type PublicationStatus =
  | "draft"
  | Validation["status"]
  | "approved"
  | "published";
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}
export interface Receipt {
  model: string;
  response_id: string;
  usage: Usage;
  cost_eur: number;
  duration_ms: number;
  pricing_version: string;
}
export interface Archive {
  version: "editorial-archive-1";
  edition_id: string;
  revision: number;
  supersedes: string | null;
  date: string;
  generated_at: string;
  engine: string;
  prompt_version: string;
  config_version: string;
  mode: "simulation" | "live" | "fallback";
  status: PublicationStatus;
  draft: EditorialDraft;
  briefing: EditorialBriefingBundle;
  illustrations: Illustration[];
  validation: Validation;
  receipt: Receipt | null;
  prompt_sha256: string;
  parameters: { model: string; max_output_tokens: number };
  checksum: string;
}
export const allBlocks = (d: EditorialDraft): Block[] => [
  d.decision,
  ...d.alternatives.map((a) => a.reason),
  d.headline,
  d.lead,
  ...d.article,
  ...d.regions.flatMap((r) => r.blocks),
  ...d.productions.flatMap((p) => p.blocks),
  ...d.limitations,
];
