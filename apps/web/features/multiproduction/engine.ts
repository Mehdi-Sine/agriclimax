import {
  calculateQualified,
  type QualifiedDay,
} from "../climate-quality/calculate";
import type { AgroResult } from "../agroclimatic/calculate";
import { calendarDays } from "../national/daily-availability";
import {
  RECIPES,
  PRODUCTIONS,
  VERSION,
  validateRegistry,
  type Recipe,
} from "./registry";
import { createHash } from "node:crypto";
import type { WeatherVariable } from "../operational/model";

/** One variable-specific adapter call per recipe. Never merge T/RH from unrelated rows. */
export interface PairEvidence {
  unit: "degC" | "%";
  from: string;
  to: string;
  source: string;
  run: string | null;
  support: string;
  identity: string;
}
export interface ProductionDay extends QualifiedDay {
  pair_evidence?: { temperature: PairEvidence; humidity: PairEvidence };
}
export type InputProvider = (
  pra: string,
  variables: readonly WeatherVariable[],
) => ProductionDay[];
export type Immutable<T> = T extends object
  ? { readonly [K in keyof T]: Immutable<T[K]> }
  : T;
function immutable<T>(value: T): Immutable<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value as Immutable<T>;
}
export interface Measurement {
  version: string;
  production: string;
  indicator: string;
  period: [string, string];
  nature: string | null;
  signature: string;
  origins: Immutable<
    {
      source: string;
      run: string | null;
      nature: string;
      support: QualifiedDay["climate_support"];
    }[]
  >;
  result: Immutable<AgroResult>;
}
function prepare(rows: ProductionDay[], recipe: Recipe): QualifiedDay[] {
  // The complete scientific identity is required, not just a mask ID. Include all
  // support semantics because an identical id can accompany a changed method.
  const signatures = new Set(
    rows.map((r) =>
      JSON.stringify([r.source, r.run, r.nature, r.climate_support]),
    ),
  );
  const stable = signatures.size <= 1;
  return rows.map((r) => {
    const pair = r.pair_evidence,
      t = pair?.temperature,
      h = pair?.humidity;
    const paired =
      !recipe.kernel.variables.includes("humidity") ||
      r.values.humidity == null ||
      (!!t &&
        !!h &&
        t.unit === "degC" &&
        h.unit === "%" &&
        [t, h].every(
          (v) =>
            v.from === r.date + "T00:00:00Z" &&
            Date.parse(v.to) - Date.parse(v.from) === 86400000 &&
            v.source === r.source &&
            v.run === r.run &&
            v.support === r.climate_support?.id &&
            v.identity ===
              (r.climate_support?.identity ?? r.climate_support?.id),
        ));
    return {
      ...r,
      quality_flags: [
        ...r.quality_flags,
        ...(!paired ? ["temperature_humidity_pair_unverified"] : []),
      ],
      compatible:
        r.compatible &&
        stable &&
        paired &&
        !!r.climate_support?.id &&
        recipe.natures.includes(
          r.nature as "observation" | "reanalysis" | "forecast",
        ),
      complete:
        r.complete &&
        Object.entries(r.values).every(
          ([k, v]) =>
            !k.startsWith("temperature") ||
            v == null ||
            (Number.isFinite(v) && v >= -100 && v <= 60),
        ) &&
        (r.values.temperature_min == null ||
          r.values.temperature_max == null ||
          r.values.temperature_min <= r.values.temperature_max) &&
        (r.values.temperature == null ||
          r.values.temperature_min == null ||
          r.values.temperature >= r.values.temperature_min) &&
        (r.values.temperature == null ||
          r.values.temperature_max == null ||
          r.values.temperature <= r.values.temperature_max),
    };
  });
}
/** Cache is local to a batch: no stale reuse between requests, sources or periods. */
export function computeBatch(
  praIds: readonly string[],
  period: [string, string],
  inputs: InputProvider,
  productions = PRODUCTIONS,
  catalogue: { version: string; recipes: readonly Recipe[] } = {
    version: VERSION,
    recipes: RECIPES,
  },
) {
  const { version, recipes } = catalogue;
  validateRegistry(productions, recipes, version);
  const dates = calendarDays(...period);
  if (
    !dates.length ||
    dates.length > 30 ||
    new Set(praIds).size !== praIds.length ||
    praIds.some((id) => !id)
  )
    throw Error("INVALID_MULTIPRODUCTION_BATCH");
  const measurements: Measurement[] = [];
  let calculations = 0,
    hits = 0;
  const recipeKeys = new Map(
    recipes.map((r) => [
      r.id,
      JSON.stringify([
        version,
        r.kernel.variables,
        r.kernel.operator,
        r.kernel.threshold,
        r.kernel.unit,
        r.kernel.formula,
        r.kernel.source,
        r.kernel.coverage_family,
        r.windows,
        r.natures,
      ]),
    ]),
  );
  for (const pra of praIds) {
    // A provider is scoped to one archive selection, independent of production
    // and threshold. Resolve each variable set once to make this invariant explicit.
    const inputCache = new Map<string, ProductionDay[]>();
    const cache = new Map<
      string,
      {
        result: Measurement["result"];
        signature: string;
        nature: string | null;
        origins: Measurement["origins"];
      }
    >();
    for (const production of productions)
      for (const id of production.indicators) {
        const recipe = recipes.find((r) => r.id === id);
        if (!recipe || !recipe.windows.includes(dates.length))
          throw Error("UNKNOWN_RECIPE_OR_WINDOW");
        // recipe identity includes unit, formula, parameters and coverage policy.
        const key = recipeKeys.get(id)!;
        let entry = cache.get(key);
        if (!entry) {
          const variableKey = recipe.kernel.variables.join();
          let raw = inputCache.get(variableKey);
          if (!raw) {
            raw = [...inputs(pra, recipe.kernel.variables)].sort((a, b) =>
              a.date.localeCompare(b.date),
            );
            inputCache.set(variableKey, raw);
          }
          const rows = prepare(raw, recipe);
          const result = calculateQualified(
            pra,
            rows,
            ...period,
            recipe.kernel,
            recipe.kernel.threshold,
          );
          const identities = [
            ...new Set(
              rows.map((r) =>
                JSON.stringify([r.source, r.run, r.nature, r.climate_support]),
              ),
            ),
          ].sort();
          const signature = createHash("sha256")
            .update(JSON.stringify([key, identities]))
            .digest("hex");
          const origins = identities.map((identity) => {
            const [source, run, nature, support] = JSON.parse(identity) as [
              string,
              string | null,
              string,
              QualifiedDay["climate_support"],
            ];
            return { source, run, nature, support };
          });
          entry = {
            result: immutable(result),
            signature,
            nature: rows[0]?.nature ?? null,
            origins: immutable(origins),
          };
          cache.set(key, entry);
          calculations++;
        } else hits++;
        // Share immutable scientific results: adding productions does not copy the
        // daily series, provenance or quality evidence for each applicability.
        measurements.push({
          version,
          production: production.id,
          indicator: id,
          period: [...period],
          ...entry,
        });
      }
  }
  return {
    version,
    measurements,
    metrics: { calculations, cache_hits: hits, pra_count: praIds.length },
  };
}
