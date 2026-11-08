import { cattleRule } from "../cattle/thi";
import type { WeatherVariable } from "../operational/model";
export type Production = "wheat" | "cattle";
export type Operator =
  | "mean"
  | "gdd"
  | "above"
  | "below"
  | "sum"
  | "longestAbove"
  | "longestBelow"
  | "thi"
  | "thiAbove"
  | "thiLongest";
export interface Rule {
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
