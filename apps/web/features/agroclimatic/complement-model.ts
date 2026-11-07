export interface ComplementaryValue {
  value: number;
  unit: string;
  rule_version: string;
  data_freshness: string[];
  source_id: string;
  source_kind: "spatial_reconstruction";
  method_version: string;
  native_spatial_coverage: 0;
  temporal_coverage: 1;
  days: number;
  support_id: string;
  scientific_status: "exploratory";
  validation: {
    reference: "ERA5-Land field, not an independent station";
    pra: number;
    pra_days: number;
    mae: number;
    p95_absolute_error: number;
    unit: "°C" | "mm/j";
  };
  provenance: string[];
  quality_flags: string[];
  series: { date: string; input_value: number; value: number }[];
}
export interface ComplementaryDay {
  date: string;
  value: number | null;
  support_id: string;
  identity: string;
  native_coverage: number;
  temporal_coverage: number;
  provenance: string;
}
