import { verifyWheatSummary, type WheatSummary } from "../wheat/national";
import { wheatRules, WHEAT_LIMITS, WHEAT_VERSION } from "../wheat/qualified";
import { coverageWheatRules, COVERAGE_WHEAT_VERSION } from "../wheat/coverage";
import type { Contribution } from "../journal/registry";
import { hash } from "./temporal";
/** Historical adapter; general editorial engine receives only the existing Contribution contract. */
export function historicalWheatContribution(s: WheatSummary): Contribution {
  if (
    !verifyWheatSummary(s) ||
    s.nature !== "reanalysis" ||
    ![WHEAT_VERSION,COVERAGE_WHEAT_VERSION].includes(s.version) ||
    s.qualification.version!==s.version ||
    s.qualification.calculation!=="technically_validated" ||
    s.qualification.agronomic_interpretation!=="not_validated" ||
    !s.qualification.descriptive_publication
  )
    throw Error("EDITORIAL_WHEAT_QUALIFICATION");
  const indicators = s.indicators.flatMap((i) => {
    const rule = [...wheatRules, ...coverageWheatRules].find(
      (r) =>
        r.id === i.id &&
        r.unit === i.unit &&
        r.formula === i.formula &&
        r.threshold === i.threshold &&
        r.source === i.reference,
    );
    const national = i.territories.find((t) => t.territory === "France"),
      m = national?.maximum;
    if (
      !rule ||
      !m ||
      !m.provenance.length ||
      !m.data_freshness.length ||
      !national ||
      national.coverage.total !== 713 ||
      national.coverage.evaluable < 1 ||
      (m.quality && m.quality.state !== "native_complete")
    )
      return [];
    return [
      {
        id: i.id,
        version: s.version,
        period: s.period,
        scale: "pra" as const,
        quality: "qualified_descriptive; exploratory_agronomic_interpretation",
        status: "available" as const,
        qualified: true,
        publishable: true,
        provenance: [s.identity, i.reference],
        limits: WHEAT_LIMITS,
        facts: [
          {
            id: hash([s.identity, i.id, m.pra]),
            text: `France : maximum territorial ${i.id}, ${m.value} ${i.unit} sur ${m.pra}, ${national.coverage.evaluable}/713 PRA évaluables. Réanalyse descriptive ; aucune conséquence agricole déduite.`,
            value: m.value,
            unit: i.unit,
            period: s.period,
            source: s.source_version,
            rule_version: s.version,
            provenance: [s.identity, ...m.provenance],
            quality_flags: m.quality_flags,
            data_freshness: m.data_freshness,
            href: "/analyse?production=wheat",
          },
        ],
      },
    ];
  });
  return {
    id: "wheat",
    label: "Blé tendre",
    family: "Grandes cultures",
    indicators,
    declared_pra_count: null,
    source: s.source_version,
    year: null,
    event_ids: [],
    href: "/analyse?production=wheat",
    limits: WHEAT_LIMITS,
  };
}
