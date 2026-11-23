import { cattleRule } from "../cattle/thi";
import type { WeatherVariable } from "../operational/model";
export type Production = "wheat" | "cattle" | "field";
export type Operator =
  | "max"
  | "atLeast"
  | "longestAtLeast"
  | "min"
  | "mean"
  | "gdd"
  | "maxRain5"
  | "above"
  | "below"
  | "sum"
  | "longestAbove"
  | "longestBelow"
  | "thi"
  | "thiAbove"
  | "thiLongest";
export interface Rule {
  priority?: { base: string; minimumDays: number; kind: "reanalysis" | "potential" };
  coverage_family?: import("../climate-quality/policy").Family;
  id: string;
  version: string;
  production: Production;
  label: string;
  family: string;
  variables: WeatherVariable[];
  operator: Operator;
  unit: string;
  threshold: number | null;
  upperTemperature?: number;
  formula: string;
  source: string;
  description: string;
  scientific_status: "exploratory";
  spatial_scale: "pra";
  temporal_scale: "daily";
  admissible_period: string;
  meteorological_source: string;
  quality: string;
  unavailable: string;
  limits: string;
}
const common = {
  version: "agroclimatic-1.0.0",
  scientific_status: "exploratory" as const,
  spatial_scale: "pra" as const,
  temporal_scale: "daily" as const,
  admissible_period:
    "Fenêtre explicite de 1 à 30 jours ; prévisions J+1 à J+7 du cycle archivé choisi.",
  meteorological_source:
    "ERA5-Land pra-native-1 ; sélection nationale AROME/ARPEGE/IFS existante.",
  quality:
    "Variables finies, physiquement admissibles, couvertures spatiale et temporelle complètes. Une seule source et initialisation par cumul.",
  unavailable:
    "Variable absente ou invalide, couverture insuffisante, période incomplète ou provenance incompatible : NULL avec motif.",
  limits:
    "Aléa territorial descriptif. Aucun stade, dommage, rendement, hectare touché ni conseil automatique. Extrêmes météo échantillonnés, représentativité littorale non garantie.",
};
const wheat = (
  id: string,
  label: string,
  family: string,
  variable: WeatherVariable,
  operator: Operator,
  unit: string,
  threshold: number | null,
  formula: string,
): Rule => ({
  ...common,
  version: id === "temperature_mean" ? "agroclimatic-1.1.0" : common.version,
  id,
  production: "wheat",
  label,
  family,
  variables: [variable],
  operator,
  unit,
  threshold,
  formula,
  description:
    label +
    " sur une fenêtre fournie explicitement, sans stade phénologique inféré.",
  source:
    operator === "mean"
      ? "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land"
      : operator === "gdd"
        ? "https://doi.org/10.1016/S0168-1923(97)00027-0"
        : "https://www.wcrp-climate.org/etccdi — méthodes de comptes et séquences ; seuils personnalisés exploratoires, pas indices ETCCDI standard.",
});
const cattle = (
  id: string,
  label: string,
  operator: Operator,
  unit: string,
): Rule => ({
  ...common,
  id,
  production: "cattle",
  label,
  family: "Exposition thermique",
  variables: ["temperature", "humidity"],
  operator,
  unit,
  threshold: operator === "thi" ? null : cattleRule.thresholds[0],
  formula:
    cattleRule.formula +
    (operator === "thi"
      ? " ; maximum des synthèses quotidiennes"
      : operator === "thiAbove"
        ? " ; nombre de jours THI > seuil"
        : " ; plus longue séquence THI > seuil"),
  description:
    "THI synthétique journalier à partir de Tmoy et RHmoy compatibles ; jamais un maximum horaire.",
  source: cattleRule.source.url,
  limits: cattleRule.notice + " " + common.limits,
});
export const RULES: Rule[] = [
  wheat(
    "gdd",
    "Somme de températures",
    "Températures",
    "temperature",
    "gdd",
    "°C·j",
    0,
    "Σ max(0, Tmoy − base)",
  ),
  wheat(
    "hot",
    "Jours de chaleur",
    "Chaleur",
    "temperature_max",
    "above",
    "jours",
    25,
    "Σ 1(Tmax > seuil)",
  ),
  wheat(
    "hot_sequence",
    "Séquence chaude maximale",
    "Chaleur",
    "temperature_max",
    "longestAbove",
    "jours",
    25,
    "max longueur des séquences calendaires Tmax > seuil",
  ),
  wheat(
    "frost",
    "Jours de gel",
    "Gel",
    "temperature_min",
    "below",
    "jours",
    0,
    "Σ 1(Tmin < seuil)",
  ),
  wheat(
    "frost_sequence",
    "Séquence de gel maximale",
    "Gel",
    "temperature_min",
    "longestBelow",
    "jours",
    0,
    "max longueur des séquences calendaires Tmin < seuil",
  ),
  wheat(
    "rain",
    "Pluie cumulée",
    "Précipitations",
    "precipitation",
    "sum",
    "mm",
    null,
    "Σ précipitation quotidienne",
  ),
  wheat(
    "heavy_rain",
    "Jours de pluie importante",
    "Précipitations",
    "precipitation",
    "above",
    "jours",
    20,
    "Σ 1(pluie > seuil)",
  ),
  wheat(
    "dry",
    "Jours secs",
    "Précipitations",
    "precipitation",
    "below",
    "jours",
    1,
    "Σ 1(pluie < seuil)",
  ),
  wheat(
    "dry_sequence",
    "Séquence sèche maximale",
    "Précipitations",
    "precipitation",
    "longestBelow",
    "jours",
    1,
    "max longueur des séquences calendaires pluie < seuil",
  ),
  cattle("thi", "THI journalier synthétique", "thi", "THI"),
  cattle("thi_days", "Jours au-dessus du seuil THI", "thiAbove", "jours"),
  cattle("thi_sequence", "Séquence de dépassement THI", "thiLongest", "jours"),
  {
    ...wheat(
      "cattle_heat",
      "Jours de chaleur météorologique",
      "Chaleur",
      "temperature_max",
      "above",
      "jours",
      25,
      "Σ 1(Tmax > seuil)",
    ),
    production: "cattle",
    limits:
      "Information de température indépendante du THI ; ne remplace pas une humidité absente. " +
      common.limits,
  },
  wheat(
    "temperature_mean",
    "Température moyenne",
    "Températures",
    "temperature",
    "mean",
    "°C",
    null,
    "Moyenne des Tmoy quotidiennes sur un support spatial explicitement défini",
  ),
];

function fieldIndicator(
  base: string,
  definition: Pick<Rule, "id" | "label" | "description" | "source" | "limits"> &
    Partial<Pick<Rule, "variables" | "operator" | "threshold" | "formula" | "coverage_family" | "upperTemperature">>,
  kind: "reanalysis" | "potential" = "reanalysis",
  minimumDays = 1,
): Rule {
  return {
    ...RULES.find(rule => rule.id === base)!,
    ...definition,
    production: "field",
    version: "agro-field-1.0.0",
    priority: { base, kind, minimumDays },
    admissible_period: `Réanalyse, fenêtre complète de ${minimumDays} à 30 jours UTC.`,
    meteorological_source: "ERA5-Land · pra-native-1",
  };
}

export const FIELD_RULES: Rule[] = [
  fieldIndicator("gdd", {
    id: "field_maize_gdd",
    label: "Chaleur accumulée pour le maïs",
    threshold: 6,
    upperTemperature: 30,
    formula: "Σ max(0, min(Tmoy PRA, 30 °C) − 6 °C)",
    coverage_family: "mean_sum",
    source: "https://www.inrae.fr/sites/default/files/pdf/Adaptation%20des%20cultures%20au%20CC-projet%20AP3C.pdf",
    description: "Quel potentiel thermique le maïs a-t-il reçu sur la période ? Comparez des fenêtres de même durée, choisies selon le calendrier local.",
    limits: "Le calcul utilise la température moyenne territoriale. Les besoins variétaux mesurés en station ne s’y appliquent pas directement. Date de semis, stade et date de récolte restent inconnus.",
  }, "potential"),
  fieldIndicator("frost", {
    id: "field_frost",
    label: "Jours de gel en période sensible",
    source: "https://www.arvalis.fr/infos-techniques/cereales-faut-il-craindre-le-retour-du-froid",
    description: "Combien de jours avec gel météorologique pendant la fenêtre que vous avez choisie ? Au printemps, rapprochez le signal du stade des cultures sur le terrain.",
    limits: "0 °C définit le gel météorologique. La température agrégée par PRA ne détecte pas tous les fonds froids. La sensibilité dépend de l’espèce, de la variété, du stade et de la durée du froid.",
  }),
  fieldIndicator("dry_sequence", {
    id: "field_dry_sequence",
    label: "Plus longue séquence sans pluie significative",
    source: "https://climate-scenarios.canada.ca/?page=climdex-indices",
    description: "Combien de jours consécutifs sans pluie significative pendant la période ? Utile pour repérer une interruption des apports de pluie, notamment après un semis.",
    limits: "Séquence bornée par la fenêtre. L’humidité du sol, l’irrigation et les besoins de la culture ne sont pas évalués.",
  }),
  fieldIndicator("rain", {
    id: "field_antecedent_rain",
    label: "Pluie reçue avant une intervention",
    source: "https://www.arvalis.fr/infos-techniques/les-cereales-vont-elles-pouvoir-compenser-face-aux-exces-deau",
    description: "Quelle pluie est tombée avant la date retenue ? Choisissez par exemple les sept jours précédant une intervention envisagée.",
    limits: "La pluie reçue apporte un contexte pour vérifier le ressuyage au champ. Portance, réserves d’eau, drainage et engorgement restent inconnus.",
  }),
  fieldIndicator("rain", {
    id: "field_peak_rain5",
    label: "Plus fort cumul de pluie sur 5 jours",
    operator: "maxRain5",
    formula: "max des sommes sur 5 jours UTC consécutifs entièrement inclus dans la période",
    coverage_family: "extreme_event",
    source: "https://climate-scenarios.canada.ca/?page=climdex-indices",
    description: "Quel a été le plus fort apport de pluie sur cinq jours consécutifs ? Repérez les épisodes concentrés susceptibles de compliquer les interventions.",
    limits: "Pic de pluie territoriale. Sans normale homologue, sol ou drainage renseigné, aucun excès statistique, engorgement ou dégât agricole ne peut être déduit.",
  }, "reanalysis", 5),
];
export const AGRO_RULES = [...RULES, ...FIELD_RULES];
