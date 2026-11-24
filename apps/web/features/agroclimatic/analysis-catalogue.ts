import { AGRO_RULES, RULES, type Rule, type ScientificContext } from "./catalogue";
import { semanticPalette } from "../cartography/registry";
import { NEW_RECIPES } from "../multiproduction/agro03";

export const ANALYSIS_VERSION = "agro-analysis-1.0.0";

const etccdi = {
  title: "ETCCDI · définitions des indices climatiques",
  url: "https://climate-scenarios.canada.ca/?page=climdex-indices",
};
const era5 = {
  title: "Muñoz-Sabater et al. (2021) · ERA5-Land",
  url: "https://doi.org/10.5194/essd-13-4349-2021",
};
const arvalis = {
  title: "ARVALIS · excès d’eau et ressuyage en céréales",
  url: "https://www.arvalis.fr/infos-techniques/les-cereales-vont-elles-pouvoir-compenser-face-aux-exces-deau",
};
const cropProductions = ["cereals", "forage", "vine", "orchard"] as const;
const rainSeason = "Toute l’année, en particulier autour des semis, passages et récoltes selon le calendrier local.";
const rainLimits = "Lame d’eau moyenne du support PRA. La pluie renseigne le contexte des travaux. Portance, drainage, engorgement et humidité du sol restent inconnus.";
const warmLimits = "Le Tmin UTC territorial décrit la météo extérieure. L’humidité, les conditions du bâtiment et la récupération thermique des animaux restent inconnues.";
const coldLimits = "Le Tmax natif est un extrême territorial échantillonné. Le froid des organes, les alternances gel-dégel à la parcelle et la sensibilité du stade restent inconnus.";
const noThreshold = "Classes de lecture cartographique. Aucun seuil agronomique.";
const wetThreshold = "P ≥ 1 mm par jour UTC selon la définition ETCCDI du jour humide.";
const wetConfidence = "Méthode météorologique documentée, appliquée à la lame d’eau moyenne qualifiée de la PRA.";
const thermalConfidence = "Méthode météorologique documentée, appliquée aux extrema quotidiens du support qualifié.";

type Context = Pick<ScientificContext, "productions" | "season" | "confidence" | "references">;
const rainContext: Context = {
  productions: cropProductions, season: rainSeason, confidence: wetConfidence,
  references: [etccdi, era5, arvalis],
};
const warmContext: Context = {
  productions: ["cattle"], season: "Saison chaude, selon la région et les conditions d’élevage.",
  confidence: thermalConfidence, references: [etccdi, era5, {
    title: "Institut de l’Élevage · gérer le stress thermique dans les bâtiments",
    url: "https://idele.fr/smartelevage/?cHash=7a0a1cbd9ab7c4e1d318160fcac1fc86&eID=cmis_download&oID=workspace%3A%2F%2FSpacesStore%2Fa4dfe36a-4970-4073-ab44-d9ef8411e45d",
  }],
};
const coldContext: Context = {
  productions: ["vine", "orchard"], season: "Repos hivernal et épisodes froids des intersaisons, selon les cultures.",
  confidence: thermalConfidence, references: [etccdi, era5],
};

function publish(kernel: Rule, supportBase: string, family: string, shortLabel: string,
  description: string, limits: string, thresholdBasis: string, context: Context,
  coverageFamily: NonNullable<Rule["coverage_family"]>, derivedFrom?: string,
): Rule {
  return {
    ...kernel,
    production: "field",
    version: ANALYSIS_VERSION,
    family,
    description,
    limits,
    source: etccdi.url,
    meteorological_source: "ERA5-Land · pra-native-1",
    admissible_period: "Réanalyse, fenêtre complète de 1 à 30 jours UTC.",
    unavailable: "Abstention si une variable manque, une journée est lacunaire ou le support commun ne peut être établi." +
      (kernel.operator === "wetIntensity" ? " Une fenêtre sans jour humide rend la moyenne indéfinie." : ""),
    coverage_family: coverageFamily,
    priority: { base: supportBase, minimumDays: 1, kind: "reanalysis" },
    science: {
      ...context,
      status: "A",
      shortLabel,
      thresholdBasis,
      palettes: [...new Set([1, 7, 30].map(days => semanticPalette(kernel.id, kernel.unit, days).id))],
      compatibility: { history: true, observation: false, forecast: false },
      editorial: "manual_descriptive_export",
      ...(derivedFrom ? { derivedFrom } : {}),
    },
  };
}

function promote(id: string, supportBase: string, family: string, shortLabel: string,
  description: string, limits: string, thresholdBasis: string, context: Context,
  coverageFamily: NonNullable<Rule["coverage_family"]>,
) {
  const kernel = NEW_RECIPES.find(recipe => recipe.id === id)!.kernel;
  return publish(kernel, supportBase, family, shortLabel, description, limits,
    thresholdBasis, context, coverageFamily, kernel.version);
}

const rain = RULES.find(rule => rule.id === "rain")!;
const wetDays = { ...rain, threshold: 1 };
const wetFamily = "Apports et persistance des pluies";
const warmFamily = "Chaleur estivale";
const coldFamily = "Froid hivernal";

export const AGRO06_RULES: Rule[] = [
  promote("wet_days1", "heavy_rain", wetFamily, "Jours humides",
    "Comptez les journées avec au moins 1 mm de pluie pour décrire la fréquence des apports.",
    rainLimits, wetThreshold, rainContext, "extreme_event"),
  promote("wet_sequence1", "dry_sequence", wetFamily, "Suite de jours humides",
    "Repérez la plus longue suite de jours humides dans la période sélectionnée.",
    rainLimits + " La suite peut se prolonger hors de la fenêtre.", wetThreshold, rainContext, "sequence"),
  promote("rain10_days", "heavy_rain", wetFamily, "Jours avec au moins 10 mm",
    "Comptez les jours ayant reçu au moins 10 mm en moyenne sur le support couvert.",
    rainLimits, "P ≥ 10 mm par jour UTC selon l’indice R10mm de l’ETCCDI.", rainContext, "extreme_event"),
  promote("rain_max1day", "heavy_rain", wetFamily, "Maximum quotidien de pluie",
    "Repérez le plus fort cumul sur une journée UTC dans la fenêtre.",
    rainLimits + " Le maximum quotidien ne décrit pas l’intensité horaire.", noThreshold, rainContext, "extreme_event"),
  publish({ ...wetDays, id: "wet_total1", label: "Cumul de pluie des jours humides",
    operator: "wetTotal", formula: "Σ P pour les jours où P ≥ 1 mm" },
    "rain", wetFamily, "Pluie des jours humides",
    "Additionnez uniquement les apports des jours avec au moins 1 mm de pluie.",
    rainLimits + " Les apports inférieurs à 1 mm sont exclus par définition.", wetThreshold, rainContext, "mean_sum"),
  publish({ ...wetDays, id: "wet_intensity1", label: "Pluie moyenne par jour humide",
    operator: "wetIntensity", unit: "mm/j humide",
    formula: "Σ P des jours où P ≥ 1 mm ÷ nombre de ces jours" },
    "heavy_rain", wetFamily, "Pluie par jour humide",
    "Comparez la lame d’eau moyenne des jours humides. Une période sans jour humide donne un résultat indisponible.",
    rainLimits + " L’indice SDII est une moyenne quotidienne. Les intensités horaires restent inconnues.",
    wetThreshold, rainContext, "extreme_event"),
  promote("warm_nights20", "frost", warmFamily, "Jours à Tmin > 20 °C",
    "Comptez les jours où le minimum territorial reste supérieur à 20 °C.",
    warmLimits, "Tmin > 20 °C, convention météorologique des nuits tropicales ETCCDI.", warmContext, "extreme_event"),
  promote("warm_nights20_sequence", "frost_sequence", warmFamily, "Suite à Tmin > 20 °C",
    "Repérez la persistance des jours où le minimum territorial reste supérieur à 20 °C.",
    warmLimits + " La suite peut se prolonger hors de la fenêtre.", "Tmin > 20 °C selon la convention ETCCDI, appliquée en séquence.", warmContext, "sequence"),
  promote("ice_days", "hot", coldFamily, "Jours à Tmax < 0 °C",
    "Comptez les jours où le maximum territorial reste inférieur à 0 °C.",
    coldLimits, "Tmax < 0 °C selon l’indice de jours sans dégel ETCCDI.", coldContext, "extreme_event"),
  promote("ice_sequence", "hot_sequence", coldFamily, "Suite à Tmax < 0 °C",
    "Repérez la persistance des jours où le maximum territorial reste inférieur à 0 °C.",
    coldLimits + " La suite peut se prolonger hors de la fenêtre.", "Tmax < 0 °C selon la convention ETCCDI, appliquée en séquence.", coldContext, "sequence"),
];

export const ANALYSIS_RULES = [...AGRO_RULES, ...AGRO06_RULES];
