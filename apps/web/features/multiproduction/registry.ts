import { RULES, type Rule } from "../agroclimatic/catalogue";
import { coverageRule } from "../climate-quality/calculate";

export const VERSION = "multiproduction-descriptive-1.0.0";
export type ScientificClass =
  | "meteorological"
  | "agroclimatic_descriptive"
  | "agronomic_interpretative";
export interface Recipe {
  id: string;
  classification: ScientificClass;
  /** Legacy production field identifies the original calculator, not applicability. */
  kernel: Rule;
  windows: readonly number[];
  natures: readonly ("observation" | "reanalysis" | "forecast")[];
  editorial: "qualified_descriptive_only";
}
const recipe = (rule: Rule): Recipe => ({
  id: rule.id,
  classification:
    rule.operator === "gdd" || rule.variables.includes("humidity")
      ? "agroclimatic_descriptive"
      : "meteorological",
  kernel: coverageRule(rule, VERSION),
  windows: Array.from({ length: 30 }, (_, i) => i + 1),
  natures: ["observation", "reanalysis", "forecast"],
  editorial: "qualified_descriptive_only",
});
const base = (id: string) => RULES.find((r) => r.id === id)!;
export const RECIPES: readonly Recipe[] = [
  ...RULES.map(recipe),
  recipe({
    ...base("gdd"),
    id: "gdd_base6",
    threshold: 6,
    label: "Somme thermique base 6 °C",
    coverage_family: "mean_sum",
  }),
  recipe({
    ...base("gdd"),
    id: "gdd_base10",
    threshold: 10,
    label: "Somme thermique base 10 °C",
    coverage_family: "mean_sum",
  }),
  recipe({
    ...base("hot"),
    id: "hot30",
    threshold: 30,
    label: "Jours Tmax > 30 °C",
    coverage_family: "extreme_event",
  }),
  recipe({
    ...base("hot_sequence"),
    id: "hot30_sequence",
    threshold: 30,
    label: "Séquence Tmax > 30 °C",
    coverage_family: "sequence",
  }),
  recipe({
    ...base("frost"),
    id: "temperature_min",
    operator: "min",
    threshold: null,
    unit: "°C",
    label: "Minimum des Tmin quotidiennes",
    formula: "min(Tmin)",
    coverage_family: "extreme_event",
  }),
  recipe({
    ...base("heavy_rain"),
    id: "rain_frequency",
    threshold: 0.1,
    label: "Jours pluie > 0,1 mm",
    coverage_family: "extreme_event",
  }),
];
export interface Production {
  id: string;
  label: string;
  family: string;
  indicators: readonly string[];
  limits: string;
}
const generic = [
  "temperature_mean",
  "temperature_min",
  "hot",
  "hot_sequence",
  "frost",
  "frost_sequence",
  "rain",
  "rain_frequency",
  "heavy_rain",
  "dry",
  "dry_sequence",
];
export const PRODUCTIONS: readonly Production[] = [
  {
    id: "wheat",
    label: "Blé tendre",
    family: "Grandes cultures",
    indicators: [
      "gdd",
      "hot",
      "hot_sequence",
      "frost",
      "frost_sequence",
      "rain",
      "heavy_rain",
      "dry",
      "dry_sequence",
      "temperature_mean",
    ],
    limits:
      "Semis, variété, stade et réserve hydrique inconnus ; aucun stade déduit des sommes thermiques.",
  },
  {
    id: "cattle",
    label: "Bovins",
    family: "Élevage",
    indicators: [
      "cattle_heat",
      "temperature_mean",
      "thi",
      "thi_days",
      "thi_sequence",
    ],
    limits:
      "Couple Tmoy/RHmoy journalier compatible requis ; THI synthétique, jamais maximum horaire ni stress animal démontré. Élevage, abri et adaptation inconnus.",
  },
  {
    id: "maize",
    label: "Maïs",
    family: "Grandes cultures",
    indicators: [
      ...generic,
      "gdd_base6",
      "gdd_base10",
      "hot30",
      "hot30_sequence",
    ],
    limits:
      "Bases conventionnelles explicites sans plafond ; semis, stade, variété, irrigation et eau du sol inconnus.",
  },
  {
    id: "vine",
    label: "Vigne",
    family: "Viticulture",
    indicators: [...generic, "gdd_base10"],
    limits:
      "Gel météorologique sans dommage démontré ; débourrement, cépage et sensibilité inconnus, jamais inférés du calendrier.",
  },
  {
    id: "grassland",
    label: "Prairies et fourrages",
    family: "Fourrages",
    indicators: [...generic, "gdd"],
    limits:
      "Aucune pousse, production fourragère ou sécheresse agricole déduite ; sol et conduite inconnus.",
  },
  {
    id: "orchard",
    label: "Vergers",
    family: "Arboriculture",
    indicators: generic,
    limits:
      "Contrat générique ; espèce, floraison, variété et sensibilité au gel inconnues. Aucun dommage inféré.",
  },
];
export function validateRegistry(productions = PRODUCTIONS, recipes = RECIPES) {
  if (
    new Set(recipes.map((r) => r.id)).size !== recipes.length ||
    new Set(productions.map((p) => p.id)).size !== productions.length ||
    productions.some(
      (p) =>
        !p.id ||
        !p.limits ||
        new Set(p.indicators).size !== p.indicators.length ||
        p.indicators.some((id) => !recipes.some((r) => r.id === id)),
    ) ||
    recipes.some(
      (r) =>
        r.kernel.version !== VERSION ||
        r.classification === "agronomic_interpretative" ||
        !r.kernel.formula ||
        !r.kernel.source ||
        !r.windows.length,
    )
  )
    throw Error("INVALID_MULTIPRODUCTION_REGISTRY");
}
validateRegistry();
