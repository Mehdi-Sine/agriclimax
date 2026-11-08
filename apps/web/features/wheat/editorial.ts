import {COVERAGE_WHEAT_VERSION, coverageWheatRules} from "./coverage";
import { createHash } from "node:crypto";
import type {
  Contributor,
  Indicator,
  IndicatorFact,
} from "../journal/registry";
import { WHEAT_VERSION, WHEAT_LIMITS, wheatRules } from "./qualified";
import { verifyWheatSummary, type WheatSummary } from "./national";

// A synchronous adapter over an already verified, bounded server snapshot.
export function WheatEditorialContributor(
  snapshots: WheatSummary[],
  failure = "verified_wheat_snapshot_unavailable",
): Contributor {
  const identities = snapshots
    .map((s) => s.identity)
    .sort()
    .join("/");
  return {
    id: "wheat",
    version: `${[...new Set(snapshots.map(s=>s.version))].sort().join("+") || COVERAGE_WHEAT_VERSION}/${identities || failure}`,
    contribute(s) {
      const presence = s.productions.find((p) => p.id === "wheat");
      const matching = snapshots.filter(
        (w) =>
          verifyWheatSummary(w) &&
          w.indicators.every(
            (i) =>
              i.territories.find((t) => t.territory === "France")?.coverage
                .total === 713,
          ) &&
          [WHEAT_VERSION, COVERAGE_WHEAT_VERSION].includes(w.qualification.version) &&
          w.qualification.scientific_status === "exploratory" &&
          [WHEAT_VERSION, COVERAGE_WHEAT_VERSION].includes(w.version) &&
          w.nature === "forecast" &&
          w.run === s.run &&
          w.source_version === s.source_version &&
          w.period[0] >= s.period[0] &&
          w.period[1] <= s.period[1] &&
          w.qualification.calculation === "technically_validated" &&
          w.qualification.agronomic_interpretation === "not_validated" &&
          w.qualification.descriptive_publication,
      );
      const indicators: Indicator[] = matching.flatMap((w) =>
        w.indicators
          .filter((i) =>
            [...wheatRules, ...coverageWheatRules].some(
              (r) =>
                r.id === i.id &&
                r.unit === i.unit &&
                r.formula === i.formula &&
                r.threshold === i.threshold &&
                r.source === i.reference,
            ),
          )
          .map((i) => {
            const href =
              "/analyse?production=wheat&agro=" +
              encodeURIComponent(i.id) +
              "&temporal=forecast&agro_start=" +
              w.period[0] +
              "&agro_end=" +
              w.period[1] +
              "&weather_run=" +
              encodeURIComponent(w.run!);
            const territories = [
              ...i.territories.filter((t) => t.territory === "France"),
              ...i.territories
                .filter(
                  (t) =>
                    t.territory !== "France" &&
                    t.maximum &&
                    !["gdd", "temperature_mean"].includes(i.id),
                )
                .sort(
                  (a, b) =>
                    (b.positive_pra ?? 0) - (a.positive_pra ?? 0) ||
                    b.maximum!.value - a.maximum!.value ||
                    a.territory.localeCompare(b.territory),
                )
                .slice(0, 1),
            ];
            const facts: IndicatorFact[] = territories.flatMap((t) => {
              const m = t.maximum,
                c = t.coverage;
              if (
                !m ||
                !Number.isFinite(m.value) ||
                !m.provenance.length ||
                !m.data_freshness.length ||
                c.evaluable <= 0 ||
                c.total < c.complete ||
                c.complete + c.partial + c.unavailable !== c.total
              )
                return [];
              const id =
                "wheat-" +
                createHash("sha256")
                  .update(
                    JSON.stringify([w.identity, i.id, t.territory, m.pra]),
                  )
                  .digest("hex")
                  .slice(0, 24);
              const coverage = w.version === COVERAGE_WHEAT_VERSION ? `${c.evaluable}/${c.total} PRA évaluables (${c.complete} supports complets, ${c.qualified_estimate ?? 0} estimations qualifiées)` : `${c.complete}/${c.total} PRA complètes`;
              const descriptive =
                i.threshold !== null && i.id !== "gdd"
                  ? `${t.positive_pra} PRA avec au moins un jour franchissant le seuil descriptif (${coverage}). `
                  : `${coverage}. `;
              return [
                {
                  id,
                  text: `${t.territory} — ${descriptive}${wheatRules.find((r) => r.id === i.id)!.label} : maximum parmi les PRA évaluables, ${m.value.toFixed(2)} ${i.unit} dans ${m.name} (${m.pra}), du ${w.period[0]} au ${w.period[1]} ; prévision. Descriptif exploratoire ; aucun stade, dommage ou rendement déduit. ${m.quality?.state === "qualified_estimate" ? "Estimation territoriale qualifiée, méthode et certificat accessibles dans les preuves. " : ""}Représentativité littorale non garantie.`,
                  value: m.value,
                  unit: i.unit,
                  period: w.period,
                  source: w.source_version,
                  rule_version: w.version,
                  provenance: [w.identity, i.reference, ...m.provenance],
                  quality_flags: [
                    ...m.quality_flags,
                    "exploratory_descriptive_publication",
                    "agronomic_interpretation_not_validated",
                  ],
                  data_freshness: m.data_freshness,
                  href: href + "&pra=" + encodeURIComponent(m.pra),
                },
              ];
            });
            return {
              id: `${i.id}:${w.period.join("/")}`,
              version: w.version,
              period: w.period,
              scale: "pra" as const,
              quality:
                "complete_homogeneous_whole_pra; technically_validated; exploratory_descriptive_only",
              status: facts.length
                ? ("available" as const)
                : ("unavailable" as const),
              qualified: facts.length > 0,
              publishable: facts.length > 0,
              provenance: [w.source_version, w.identity, i.reference],
              limits: WHEAT_LIMITS,
              facts,
            };
          }),
      );
      if (!indicators.length)
        for (const r of wheatRules)
          indicators.push({
            id: r.id,
            version: r.version,
            period: s.period,
            scale: "pra",
            quality: failure,
            status: "unavailable",
            qualified: false,
            publishable: false,
            provenance: [r.source],
            limits: WHEAT_LIMITS,
          });
      return {
        id: "wheat",
        label: "Blé tendre",
        family: "Grandes cultures",
        indicators,
        declared_pra_count: presence?.pra_ids.length ?? null,
        source: presence?.source ?? "catalogue blé descriptif",
        year: presence?.year ?? null,
        event_ids: [],
        href: "/analyse?production=wheat",
        limits: WHEAT_LIMITS,
      };
    },
  };
}
