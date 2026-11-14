/** Offline opt-in catalogue. No production module imports this file. */
import { RECIPES, PRODUCTIONS, validateRegistry, type Recipe, type Production } from "./registry";
import { computeBatch, type InputProvider } from "./engine";
import type { Rule } from "../agroclimatic/catalogue";

export const AGRO03_VERSION = "multiproduction-agro03-1.0.0";
export const REFERENCES = {
  etccdi: {
    title: "ETCCDI — Definitions of the 27 core indices",
    url: "https://etccdi.pacificclimate.org/list_27_indices.shtml",
    scope: "TR: Tmin >20 °C ; ID: Tmax <0 °C ; R10mm: P ≥10 mm ; CWD: P ≥1 mm ; Rx1day: max P. Fenêtres ici explicites, pas indices annuels officiels.",
  },
  thermal: {
    title: "McMaster & Wilhelm (1997), Growing degree-days: one equation, two interpretations",
    url: "https://doi.org/10.1016/S0168-1923(97)00027-0",
    scope: "Méthode des sommes thermiques ; ne valide ni base spécifique, ni stade, ni variété.",
  },
  cattle: {
    title: "Bohmanova et al. (2005), Temperature-humidity indices as indicators of milk production losses due to heat stress",
    url: "https://www.ars.usda.gov/ARSUserFiles/80420530/Publications/Scientific/Conferences/2005/IB_33_160_BohmanovaEtAl.pdf",
    scope: "Formule THI héritée, contexte bovin laitier ; aucune transposition automatique viande, porcs ou volailles.",
  },
  era5: {
    title: "Muñoz-Sabater et al. (2021), ERA5-Land: a state-of-the-art global reanalysis dataset for land applications",
    url: "https://doi.org/10.5194/essd-13-4349-2021",
    scope: "Source météorologique ; ne démontre pas la représentativité de chaque élevage ou parcelle.",
  },
} as const;
type ReferenceId = keyof typeof REFERENCES;
const inherited = (id: string) => RECIPES.find(r => r.id === id)!;
function variant(base: string, change: Partial<Rule> & Pick<Rule, "id" | "label" | "formula">): Recipe {
  const original = inherited(base);
  return {
    ...original,
    kernel: {
      ...original.kernel, ...change, version: AGRO03_VERSION,
      description: `${change.label} sur une fenêtre UTC explicite, descriptive et sans stade inféré.`,
      source: REFERENCES.etccdi.url,
    },
    id: change.id,
  };
}
export const NEW_RECIPES: readonly Recipe[] = [
  variant("hot", { id: "warm_nights20", label: "Jours à Tmin > 20 °C", variables: ["temperature_min"], threshold: 20, formula: "Σ 1(Tmin > 20 °C)" }),
  variant("hot_sequence", { id: "warm_nights20_sequence", label: "Séquence de jours à Tmin > 20 °C", variables: ["temperature_min"], threshold: 20, formula: "max longueur calendaire Tmin > 20 °C" }),
  variant("heavy_rain", { id: "wet_days1", label: "Jours humides (pluie ≥ 1 mm)", threshold: 1, operator: "atLeast", formula: "Σ 1(P ≥ 1 mm)" }),
  variant("dry_sequence", { id: "wet_sequence1", label: "Séquence humide maximale (pluie ≥ 1 mm)", threshold: 1, operator: "longestAtLeast", formula: "max longueur calendaire P ≥ 1 mm" }),
  variant("heavy_rain", { id: "rain10_days", label: "Jours de pluie ≥ 10 mm", threshold: 10, operator: "atLeast", formula: "Σ 1(P ≥ 10 mm)" }),
  variant("heavy_rain", { id: "rain_max1day", label: "Maximum de pluie quotidienne", threshold: null, operator: "max", unit: "mm", formula: "max(P quotidienne)" }),
  variant("frost", { id: "ice_days", label: "Jours sans dégel (Tmax < 0 °C)", variables: ["temperature_max"], formula: "Σ 1(Tmax < 0 °C)" }),
  variant("frost_sequence", { id: "ice_sequence", label: "Séquence de jours sans dégel", variables: ["temperature_max"], formula: "max longueur calendaire Tmax < 0 °C" }),
];
const allNew = NEW_RECIPES.map(r => r.id);
const weather = ["temperature_mean", "temperature_min", "hot", "hot_sequence", "frost", "frost_sequence", "rain", "rain_frequency", "heavy_rain", "dry", "dry_sequence"];
const animal = ["temperature_mean", "hot", "hot_sequence", "warm_nights20", "warm_nights20_sequence", "ice_days", "ice_sequence"];
const animalLimits = "Météo extérieure territoriale ; bâtiment, ventilation, densité, âge, race et acclimatation inconnus. Aucun stress animal, récupération nocturne ou effet zootechnique déduit. Tmin UTC n'est pas une mesure nocturne de bâtiment.";
export const AGRO03_PRODUCTIONS: readonly Production[] = [
  ...PRODUCTIONS.map(p => ({ ...p, indicators: [...p.indicators, ...allNew] })),
  { id: "rapeseed", label: "Colza", family: "Grandes cultures", indicators: [...weather, ...allNew], limits: "Semis, stade, variété, enracinement, réserve hydrique et pratiques inconnus. Aucun dégât de gel ou déficit hydrique déduit." },
  { id: "dairy_cattle", label: "Bovins lait", family: "Élevage", indicators: [...animal, "thi", "thi_days", "thi_sequence"], limits: animalLimits + " THI quotidien hérité exploratoire, couples T/RH qualifiés requis ; seuil 72 non universel." },
  { id: "beef_cattle", label: "Bovins viande", family: "Élevage", indicators: animal, limits: animalLimits + " THI laitier non transposé ; rayonnement, vent et contexte animal nécessaires à une règle dédiée." },
  { id: "pigs", label: "Porcins", family: "Élevage", indicators: animal, limits: animalLimits + " THI porcin reporté faute de règle espèce/stade/bâtiment et mesures adéquates." },
  { id: "poultry", label: "Volailles", family: "Élevage", indicators: animal, limits: animalLimits + " Espèce et âge nécessaires ; THI bovin non transposé." },
];
export interface AgronomicMetadata {
  description: string;
  productions: readonly string[];
  parameters: { scope: "generic_meteorological" | "production_configuration_required"; threshold: number | null; unit: "degC" | "mm" | "THI" | null; comparator: ">" | ">=" | "<" | "base" | null; interpretation: string };
  relevant_periods: readonly { production: string; period: string; status: "context_only" }[];
  references: readonly ReferenceId[];
  validation: "documented_method_exploratory_application";
  availability: string;
  interpretation_limits: readonly string[];
  editorial: { kind: "hazard_descriptor"; agricultural_interest: string; causal_claims_allowed: false; damage_threshold: null; required_context: readonly string[] };
}
const period = (id: string) => ["wheat", "rapeseed"].includes(id)
  ? "Fenêtre choisie selon semis et stades observés ; automne à été, calendrier local à fournir."
  : id === "maize" ? "Campagne printemps–automne ; semis et stades à fournir."
  : ["vine", "orchard"].includes(id) ? "Repos et cycle végétatif ; espèce, stade et dates locales à fournir."
  : id === "grassland" ? "Période de végétation et fenêtres de récolte définies par l'utilisateur."
  : "Toute l'année ; vigilance thermique selon saison et conditions réelles d'élevage.";
export const AGRO03_RECIPES: readonly Recipe[] = [...RECIPES, ...NEW_RECIPES].map(r => ({ ...r, kernel: { ...r.kernel, version: AGRO03_VERSION } }));
export const AGRONOMY: Readonly<Record<string, AgronomicMetadata>> = Object.fromEntries(AGRO03_RECIPES.map(r => {
  const k = r.kernel, thi = k.variables.includes("humidity"), thermal = k.operator === "gdd";
  const productions = AGRO03_PRODUCTIONS.filter(p => p.indicators.includes(r.id)).map(p => p.id);
  const limits = [k.limits, "Phénomène sur la météo agrégée d'un support PRA, pas fraction de parcelles ou d'animaux affectés.", "Séquences censurées aux bornes ; durée totale d'un épisode extérieur à la fenêtre inconnue.", "Tmin/Tmax quotidiens archivés peuvent être issus d'échantillons horaires ; Tmin UTC n'identifie ni nuit locale ni récupération physiologique."];
  return [r.id, {
    description: k.description, productions,
    parameters: {
      scope: thermal || thi ? "production_configuration_required" : "generic_meteorological",
      threshold: k.threshold,
      unit: k.threshold === null ? null : thi ? "THI" : k.variables[0] === "precipitation" ? "mm" : "degC",
      comparator: k.threshold === null ? null : thermal ? "base" : ["atLeast", "longestAtLeast"].includes(k.operator) ? ">=" : ["above", "longestAbove", "thiAbove", "thiLongest"].includes(k.operator) ? ">" : "<",
      interpretation: thermal ? "Base descriptive héritée ; choix espèce/variété/stade à justifier. Aucun stade calculé." : thi ? "Seuil bovin exploratoire ; non universel, jamais transposé aux autres espèces." : "Convention météo documentée ; aucun seuil de dommage agricole.",
    },
    relevant_periods: productions.map(production => ({ production, period: period(production), status: "context_only" })),
    references: [thi ? "cattle" : thermal ? "thermal" : "etccdi", "era5"],
    validation: "documented_method_exploratory_application",
    availability: "1–30 jours UTC complets ; variables en °C/mm/% qualifiées individuellement ; même source, cycle, nature et support. Prévision limitée aux jours archivés J+1…J+7. CORE-01 inchangé : portion observée séparée, aucun certificat inventé. Absence/incompatibilité : null et motif. RH qualifiée absente des archives opérationnelles inspectées : THI indisponible.",
    interpretation_limits: limits,
    editorial: {
      kind: "hazard_descriptor", causal_claims_allowed: false, damage_threshold: null,
      agricultural_interest: thi ? "Décrire l'environnement thermo-hygrométrique bovin si le couple journalier est qualifié." : thermal ? "Décrire l'accumulation de chaleur avec une base explicite, sans inférer de stade." : k.variables[0] === "precipitation" ? "Contextualiser les apports et persistances de pluie autour des travaux et besoins hydriques, sans bilan de sol." : "Contextualiser la persistance de chaleur ou de froid autour de productions potentiellement sensibles, sans démontrer d'exposition ni de dommage.",
      required_context: ["présence réelle de la production", "stade/âge", "sol et pratiques ou conditions du bâtiment", "représentativité locale"],
    },
  } satisfies AgronomicMetadata];
}));
export const AGRO03_CATALOGUE = { version: AGRO03_VERSION, recipes: AGRO03_RECIPES };
validateRegistry(AGRO03_PRODUCTIONS, AGRO03_RECIPES, AGRO03_VERSION);
export function computeAgro03(praIds: readonly string[], window: [string, string], inputs: InputProvider) {
  return computeBatch(praIds, window, inputs, AGRO03_PRODUCTIONS, AGRO03_CATALOGUE);
}
