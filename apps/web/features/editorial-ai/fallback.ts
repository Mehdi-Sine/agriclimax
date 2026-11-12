import type { EditorialBriefingBundle } from "../editorial/briefing";
import type { Block, EditorialDraft } from "./model";
export function fallbackDraft(b: EditorialBriefingBundle): EditorialDraft {
  const literal = (
    text: string,
    evidence_ids: string[] = [],
    kind: Block["kind"] = "limitation",
  ): Block => ({ text, evidence_ids, seasonal_ids: [], kind });
  const c = b.candidates[0],
    fs = c?.evidence_ids ?? [];
  return {
    version: "editorial-draft-1",
    bundle_id: b.bundle_id,
    edition_date: b.edition_date,
    main_candidate_id: c?.id ?? null,
    decision: literal("Édition expérimentale de secours établie à partir des faits disponibles."),
    alternatives: [],
    secondary_candidate_ids: [],
    headline: literal(
      "Le point agroclimatique : des faits à mettre en perspective",
    ),
    lead: literal(
      "Cette édition expérimentale de secours rassemble les données disponibles et leurs limites. " +
      (c?.nature === "forecast"
        ? "L’article présente des prévisions issues des modèles, pour les périodes indiquées."
        : c?.nature === "reanalysis"
          ? "L’article présente une réanalyse historique, pour les périodes indiquées."
          : "Les sources et les périodes restent celles des faits disponibles."),
    ),
    article: fs.map((id) =>
      literal(b.national.facts.find((f) => f.id === id)!.text, [id], "fact"),
    ),
    key_figures: [],
    regions: [],
    productions: b.contributions
      .filter(
        (x, i, a) => a.findIndex((y) => y.production === x.production) === i,
      )
      .map((p) => ({
        production_id: p.production,
        blocks: [
          literal(
            b.national.facts.find((f) => f.id === p.fact_id)!.text,
            [p.fact_id],
            "fact",
          ),
        ],
      })),
    news_ids: [],
    illustration_ids: [],
    limitations: [
      literal(
        "Les fenêtres saisonnières sont théoriques. Aucun stade réel ni effet sur les récoltes n’est déduit.",
      ),
    ],
  };
}
