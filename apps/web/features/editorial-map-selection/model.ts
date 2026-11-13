import type {EditionMap} from "../edition-maps/model";
export const VERSION = "edit03-map-ranking-1";
export const WEIGHTS = {importance: .30, agriculture: .25, extent: .15, actuality: .15, quality: .10, diversity: .05} as const;
export type Axis = keyof typeof WEIGHTS;
export interface CatalogueCard {
  id: string; edition_id: string; edition_date: string;
  indicator: string; title: string; nature: EditionMap["nature"]; family: string;
  period: [string,string]; unit: string; sources: string[]; cycles: string[];
  interactive_url: string; data_url: string; input_sha256: string;
  rule_versions: string[]; data_freshness: {reference_date: string; age_days: number; metadata_count: number; examples: string[]};
  coverage: {total: number; qualified: number; proportion: number; partial: number; missing: number; journal_excluded: number};
  intensity: {min: number|null; max: number|null; median: number|null; amplitude: number|null};
  distribution: {bounds: (number|null)[]; counts: number[]; reference: string; meaning: string};
  threshold: {criterion: string; count: number; proportion: number; source: string}|null;
  regions: {region: string; total: number; qualified: number; affected: number|null; min: number|null; max: number|null}[];
  agriculture: {productions: {id: string; label: string; limits: string}[]; applicability_reference: string; seasonal: {id: string; question: string; productions: string[]; source_ids: string[]; sources: {id: string; url: string}[]; reserve: string}[]};
  comparison: {status: "available"|"not_comparable"|"no_previous"; reason: string; previous_map_id: string|null; matched_pra: number; median_delta: number|null};
  quality_flags: string[]; limitations: string[];
  admission: {eligible: boolean; reasons: string[]};
  // Internal pairwise redundancy support. Never sent as raw PRA values to the model.
  qualified_values: {pra: string; value: number}[];
}
export interface RankedCard {
  card: CatalogueCard; axes: Record<Axis,number>; weighted_score: number;
  redundancy_penalty: number; redundancy_with: string|null; score: number;
  selected: boolean; reasons: {id: string; text: string}[];
}
export interface Simulation {
  version: typeof VERSION; mode: "simulation"; publication_enabled: false;
  edition_id: string; edition_date: string; weights: typeof WEIGHTS;
  policy: {min_score: number; max_cards: number; max_redundancy_penalty: number};
  selected_ids: string[]; ranked: RankedCard[];
}
export interface SelectionView {
  version: "edit03-ux-1"; mode: "simulation"; publication_enabled: false;
  edition_id: string; hero_map_id: string|null;
  cards: {map_id: string; order: number; role: "hero"|"priority"|"complementary"; title: string; caption: string; interactive_url: string}[];
}
