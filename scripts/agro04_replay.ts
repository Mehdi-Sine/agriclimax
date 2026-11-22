/** Read-only replay of the operational dossier. Outputs remain in work/. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import geography from "../apps/web/data/operational/pra-watch-places.json";
import { prepareDossier } from "./nightly_prepare";
import { prepareTerritorialWatch, territorialProfiles, OTEX_PROVENANCE } from "../apps/web/lib/server/agro-territorial";
import { adaptHistory, hash } from "../apps/web/features/editorial/temporal";
import { HISTORY_ADAPTER_VERSION } from "../apps/web/features/nightly/frozen-source-pins";
import { sealArchive, verifyArchive } from "../apps/web/features/editorial-ai/archive";
import { fallbackDraft } from "../apps/web/features/editorial-ai/fallback";
import { validateDraft } from "../apps/web/features/editorial-ai/validate";
import { CONFIG_VERSION, ENGINE } from "../apps/web/features/editorial-ai/model";
import { editorialPrompt } from "../apps/web/features/editorial-ai/prompt";
import { budgetReport, editorialPayload } from "../apps/web/features/editorial-ai/budget";
import { readConfig } from "../apps/web/features/editorial-ai/config";
import type { EditorialBriefingBundle } from "../apps/web/features/editorial/briefing";

async function main() {
  const date = process.argv[2];
  if (!date) throw Error("EDITORIAL_DATE_REQUIRED");
  const out = join("work", "agro04", date);
  mkdirSync(out, { recursive: true });
  process.env.AGRICLIMAX_AGRO04_PREVIEW = "true";
  const prepared = await prepareDossier({
    date, out, readOnly: true, testOnly: true, persistInputs: false,
    phase: phase => console.log(phase),
  });
  const after = prepared.snapshot.briefing;
  if (!after) throw Error("BRIEFING_UNAVAILABLE");
  const { territorial_watch: selected, ...before } = after;
  before.bundle_id = hash({ ...before, bundle_id: undefined });
  const history = adaptHistory(prepared.inputs.history, geography.places, HISTORY_ADAPTER_VERSION);
  const start = performance.now();
  const audit = await prepareTerritorialWatch(
    date, after.validity.history_cutoff, history, prepared.inputs.document ?? undefined, geography.places,
  );
  const elapsed_ms = performance.now() - start;
  if (hash(audit.selected) !== hash(selected ?? [])) throw Error("NONDETERMINISTIC_WATCH");
  const profiles = await territorialProfiles();
  const bytes = (s: string) => Buffer.byteLength(s);
  const payloadBefore = editorialPayload(before), payloadAfter = editorialPayload(after);
  const report = {
    date, otex: OTEX_PROVENANCE, total_pra: Object.keys(profiles).length,
    sampled_pra: Object.values(profiles).filter(p => p.sampled).length,
    budget: { before: budgetReport(payloadBefore, readConfig({}), []), after: budgetReport(payloadAfter, readConfig({}), []) },
    statuses: Object.groupBy(audit.evaluated, e => e.state),
    selected, elapsed_ms, openai_calls: 0,
    payload_before: bytes(payloadBefore), payload_after: bytes(payloadAfter),
    gzip_delta: gzipSync(payloadAfter).length - gzipSync(payloadBefore).length,
  };
  const { statuses, ...metrics } = report;
  writeFileSync(join(out, "report.json"), JSON.stringify({
    ...metrics, counts: Object.fromEntries(Object.entries(statuses).map(([key, rows]) => [key, rows!.length])),
  }, null, 2) + "\n");
  writeFileSync(join(out, "territoires.json.gz"), gzipSync(JSON.stringify({
    profiles, ...audit,
  })));
  for (const [label, briefing] of [["avant", before], ["apres", after]] as [string, EditorialBriefingBundle][]) {
    const dir = join(out, label, "editions");
    mkdirSync(dir, { recursive: true });
    const edition_id = hash([date, label, briefing.bundle_id]);
    const draft = fallbackDraft(briefing);
    const validation = validateDraft(draft, briefing);
    if (validation.status === "rejected") throw Error(JSON.stringify(validation));
    const prompt = editorialPrompt(!!briefing.territorial_watch?.length);
    const archive = sealArchive({
      version: "editorial-archive-1", edition_id, revision: 1, supersedes: null,
      date, generated_at: briefing.generated_at, engine: ENGINE, prompt_version: prompt.version,
      config_version: CONFIG_VERSION, mode: "simulation", status: validation.status, draft, briefing,
      illustrations: [], validation, receipt: null, prompt_sha256: hash(prompt.instructions),
      parameters: { model: "offline", max_output_tokens: 6000 },
    });
    verifyArchive(archive);
    writeFileSync(join(dir, edition_id + ".json"), JSON.stringify(archive));
  }
  console.log(JSON.stringify(metrics));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
