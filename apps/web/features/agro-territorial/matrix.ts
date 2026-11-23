export const RULE_VERSION = "agro-territorial-1";

export const PRODUCTIONS = {
  cereals: { label: "Céréales, oléagineux et légumineuses", groups: [1, 2, 3, 4, 5, 6, 7, 8, 14, 15] },
  vine: { label: "Vigne", groups: [21] },
  orchard: { label: "Vergers", groups: [20] },
  forage: { label: "Prairies et cultures fourragères", groups: [16, 18, 19] },
} as const;

export const ORIENTATIONS = {
  L: "Bovins lait",
  V: "Bovins viande",
  B: "Bovins mixtes",
  O: "Ovins et caprins",
  P: "Granivores (porcins et volailles)",
} as const;

export const MATRIX = [
  {
    id: "rain-field-access", phenomenon: "rain", productions: ["cereals"],
    window: "ALM-005", source: "ARV_SEMIS",
    mechanism: "Des pluies importantes peuvent retarder le ressuyage avant une intervention sur les parcelles.",
    limitation: "Vérifier la portance sur place. Le cumul journalier ne renseigne ni le drainage, ni l’humidité initiale, ni les travaux en cours.",
  },
  {
    id: "frost-vine", phenomenon: "frost", productions: ["vine"],
    window: "ALM-021", source: "VITI_GUIDE",
    mechanism: "La sensibilité de la vigne au gel augmente lorsque les organes verts sont sortis.",
    limitation: "Vérifier le débourrement, le relief et la température dans la parcelle. Le minimum de la PRA ne localise pas le gel dans le vignoble.",
  },
  {
    id: "frost-orchard", phenomenon: "frost", productions: ["orchard"],
    window: "ALM-025", source: "CTI_PHENO",
    mechanism: "Les bourgeons et fleurs des arbres fruitiers peuvent être sensibles au gel suivant leur développement.",
    limitation: "Vérifier l’espèce, le stade et le microclimat du verger. Le calendrier apporte un repère indicatif.",
  },
  {
    id: "heat-cattle", phenomenon: "heat", productions: ["L", "V", "B"],
    window: "ALM-039", source: "IDE_SECH",
    mechanism: "Une température élevée peut compliquer la dissipation de chaleur chez les bovins.",
    limitation: "Vérifier humidité, durée, ventilation, ombre et conditions d’élevage. Le Tmax sert au repérage météorologique. Les OTEX sont des orientations échantillonnées en 2020.",
  },
] as const;
