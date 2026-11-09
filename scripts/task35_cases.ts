/** Offline case A/B replay preparation. Only existing verified T33/AGRO-01/CORE-01 archives. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildBriefing } from "../apps/web/features/editorial/briefing";
import { assertBriefing } from "../apps/web/features/editorial/validate";
import { assertEdition } from "../apps/web/features/journal/validate";
import { hash } from "../apps/web/features/editorial/temporal";
import { generate } from "../apps/web/features/editorial-ai/generate";
import { EditorialStore } from "../apps/web/features/editorial-ai/archive";
import { fallbackDraft } from "../apps/web/features/editorial-ai/fallback";
import { readConfig } from "../apps/web/features/editorial-ai/config";
import type { JournalMapData } from "../apps/web/features/journal/ui/map-data";
import type {
  Block,
  Illustration,
} from "../apps/web/features/editorial-ai/model";
async function main() {
  const edition: unknown = JSON.parse(
    readFileSync("docs/codex/agro01/evidence/journal.json", "utf8"),
  );
  assertEdition(edition);
  const maps = (
    JSON.parse(
      gunzipSync(
        readFileSync("docs/codex/CORE-01/evidence/watch.json.gz"),
      ).toString(),
    ) as { maps: JournalMapData[] }
  ).maps;
  const b = buildBriefing({
    date: "2026-11-08",
    generated_at: edition.generated_at,
    history_cutoff: "2026-11-07",
    source_fingerprint: edition.provenance[0],
    episode_archive_sha256: hash([]),
    history: [],
    episodes: [],
    comparisons: [],
    edition,
  });
  assertBriefing(b);
  const c = b.candidates.find((c) => c.phenomenon === "frost")!,
    f = b.national.facts.find((f) => c.evidence_ids.includes(f.id))!;
  const map = maps.find(
    (m) =>
      m.phenomenon === c.phenomenon &&
      m.source === edition.provenance[0] &&
      m.run === edition.source_cycles[0],
  )!;
  if (!map) throw Error("NO_REAL_MAP");
  const asset: Illustration = {
    id: hash(map),
    sha256: hash(map),
    caption:
      "Températures minimales prévues, données archivées du cycle indiqué.",
    phenomenon: map.phenomenon,
    period: map.period,
    cycle: map.run,
    evidence_ids: c.evidence_ids,
    data: map,
  };
  const d = fallbackDraft(b),
    block = (
      text: string,
      kind: Block["kind"] = "fact",
      seasonal_ids: string[] = [],
    ): Block => ({ text, kind, evidence_ids: c.evidence_ids, seasonal_ids });
  d.main_candidate_id = c.id;
  d.headline = block(
    "Le froid prévu en Auvergne-Rhône-Alpes appelle une lecture locale",
  );
  d.lead = block(
    "Les prévisions décrivent des températures minimales contrastées en Auvergne-Rhône-Alpes. La carte archivée permet d’examiner les petites régions agricoles sans transformer un extrême local en caractéristique régionale. Le contexte saisonnier invite à poser des questions sur les cultures, sans supposer leur stade réel.",
  );
  d.decision = block(
    "Le froid est retenu pour la lisibilité des preuves et de la carte disponible. La seule étendue territoriale ne suffit pas à établir une priorité agricole.",
  );
  d.article = [
    block(f.text),
    block("Une carte pour distinguer les territoires"),
    block(
      "L’intérêt de cette lecture se situe à la maille des petites régions agricoles. Les contrastes de température ne décrivent pas directement les conditions de chaque parcelle. Ils ne renseignent pas non plus sur la présence d’une culture sensible au moment où le froid est prévu. La carte conserve les états partiels et indisponibles plutôt que de les transformer en absence de phénomène.",
    ),
    block(
      "La période habituelle des travaux agricoles fournit un contexte saisonnier. Elle ne permet pas de déduire les interventions réalisées, la levée des cultures ou leur sensibilité. La question utile est donc celle des informations de terrain à confronter aux prévisions, avec des dates et des territoires compatibles.",
      "context",
      c.seasonal_window_ids.slice(0, 1),
    ),
    block("Ce qui reste à surveiller"),
    block(
      "La prochaine mise à jour météorologique permettra de réexaminer la localisation du phénomène. Une différence entre cycles ne prouverait pas une évolution déjà mesurée sur le terrain. Pour une décision agricole, les observations locales et les règles techniques adaptées à la production resteraient nécessaires.",
    ),
  ];
  d.regions = [{ region: c.regions[0], blocks: [block(f.text)] }];
  d.key_figures = [];
  d.illustration_ids = [asset.id];
  const a = await generate({
    briefing: b,
    config: readConfig({}),
    store: new EditorialStore("work/task35/case-b"),
    mode: "simulation",
    simulation: d,
    illustrations: [asset],
    now: "2026-11-08T05:30:00Z",
  });
  if (a.mode !== "simulation" || a.validation.errors.length)
    throw Error("CASE_REJECTED");
  writeFileSync(
    "docs/codex/task35/evidence/forecast-edition.json",
    JSON.stringify(a) + "\n",
  );
  console.log(
    JSON.stringify({
      id: a.edition_id,
      bytes: Buffer.byteLength(JSON.stringify(a)),
      map_rows: map.rows.length,
      validation: a.validation,
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
