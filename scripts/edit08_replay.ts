/** Offline editorial rehearsal, using immutable inputs retrieved with int01_maps prepare. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { verifyArchive } from "../apps/web/features/editorial-ai/archive";
import { editorialPayload } from "../apps/web/features/editorial-ai/budget";
import { cost } from "../apps/web/features/editorial-ai/config";
import { operationalConfig } from "../apps/web/features/editorial-ai/generate-operational";
import { inputTokenBound, requestBody } from "../apps/web/features/editorial-ai/provider";
import { validateDraft } from "../apps/web/features/editorial-ai/validate";
import type { Archive, Block } from "../apps/web/features/editorial-ai/model";
import { chooseDaily, dailyRequest, selectedMapIds } from "../apps/web/features/editorial-map-selection/daily";
import { mapInfo, verifyBundle, type EditionMapsView } from "../apps/web/features/edition-maps/model";
import { hash } from "../apps/web/features/editorial/temporal";
import { assertBriefing } from "../apps/web/features/editorial/validate";
import { verifySnapshot, type DailyEditorialSnapshot } from "../apps/web/features/nightly/snapshot";
import { editorialFieldSummaries } from "../apps/web/lib/server/editorial-field";
import { decodeFrozenMapInputs } from "./edit04_frozen";

async function replay(root: string, day: string) {
  const dir = join(root, day);
  const original = JSON.parse(readFileSync(join(dir, "archive.json"), "utf8")) as Archive;
  const snapshot = JSON.parse(readFileSync(join(dir, "snapshot.json"), "utf8")) as DailyEditorialSnapshot;
  verifyArchive(original, false);
  verifySnapshot(snapshot);
  if (original.briefing.bundle_id !== snapshot.briefing?.bundle_id || !snapshot.input_archive) throw Error("SNAPSHOT_BINDING");

  const input = readFileSync(join(dir, "frozen-inputs.json.gz"));
  if (input.length !== snapshot.input_archive.bytes ||
      createHash("sha256").update(input).digest("hex") !== snapshot.input_archive.sha256) throw Error("INPUT_BINDING");
  const started = performance.now();
  const frozen = await decodeFrozenMapInputs(input, snapshot);
  const computation = performance.now();
  const agro_field = await editorialFieldSummaries(frozen.history, snapshot.briefing.validity.history_cutoff);
  const computationMs = Math.round(performance.now() - computation);
  const prior = day === "23"
    ? JSON.parse(readFileSync(join(root, "22", "archive.json"), "utf8")) as Archive
    : undefined;
  if (prior) verifyArchive(prior, false);
  const previous = [...new Set(prior?.draft.article.flatMap(block => block.seasonal_ids) ?? [])];
  const briefing = { ...snapshot.briefing, agro_field, ...(previous.length ? { previous_seasonal_ids: previous } : {}) };
  briefing.bundle_id = hash({ ...briefing, bundle_id: undefined });
  assertBriefing(briefing);
  if (agro_field.length !== 4 || agro_field.some(s => s.evaluable_pra !== 645)) throw Error("AGRO_REPLAY_COVERAGE");

  const draft = structuredClone(original.draft);
  draft.bundle_id = briefing.bundle_id;
  const originalHeadline = draft.headline.text;
  const fact = (at: number, text: string): Block => ({
    kind: "fact", text, seasonal_ids: [], evidence_ids: [briefing.national.facts[at].id],
  });
  const regions = (entries: [string, Block][]) => entries.map(([region, block]) => ({ region, blocks: [block] }));
  if (day === "22") {
    draft.headline.text = "Travaux d’automne : où les modèles prévoient les pluies les plus fortes";
    draft.lead.text = "Du 22 au 28 novembre, les pluies prévues en Auvergne-Rhône-Alpes appellent une lecture à la parcelle. Les modèles indiquent aussi un signal de gel dans la région. La carte permet de situer le signal de pluie avant d’examiner les conditions locales.";
    draft.article = [
      fact(0, "En Auvergne-Rhône-Alpes, les modèles prévoient plus de 20 mm de pluie en une journée dans 84 petites régions agricoles sur 112 évaluables."),
      fact(10, "En Provence-Alpes-Côte d’Azur, les 35 PRA évaluables franchissent le critère de pluie quotidienne dans les modèles."),
      fact(6, "Dans le Grand Est, les modèles indiquent une séquence d’au moins 3 jours avec moins de 1 mm de pluie par jour dans 42 PRA évaluables."),
      original.draft.article[2],
    ];
    draft.regions = regions([
      ["Auvergne-Rhône-Alpes", fact(0, "Le maximum territorial de pluie prévu atteint 103,7 mm. Il s’agit d’un extrême local.")],
      ["Nouvelle-Aquitaine", fact(2, "Le maximum territorial de pluie prévu atteint 43,5 mm, avec un franchissement du critère de pluie quotidienne dans 73 PRA évaluables.")],
      ["Grand Est", fact(3, "Les modèles indiquent un gel météorologique dans les 70 PRA évaluables. Le minimum territorial prévu atteint -6,3 °C.")],
    ]);
  } else {
    draft.headline.text = "Gel prévu : le froid à lire à l’échelle des parcelles";
    draft.lead.text = "Du 23 au 29 novembre, les modèles prévoient du gel en Auvergne-Rhône-Alpes. La carte des jours de gel permet de distinguer les territoires où le froid revient plusieurs jours. La sensibilité des cultures demanderait un relevé des stades et des conditions locales.";
    draft.article = [
      fact(0, "En Auvergne-Rhône-Alpes, les 112 PRA évaluables passent sous le seuil météorologique de 0 °C dans les prévisions."),
      fact(7, "En Centre-Val de Loire, les modèles prévoient une séquence sans pluie significative dans les 45 PRA évaluables. Le maximum territorial atteint 4 jours."),
      fact(6, "En Auvergne-Rhône-Alpes, les modèles prévoient aussi un franchissement du seuil de pluie quotidienne dans 53 des 112 PRA évaluables."),
      { ...fact(0, "Question saisonnière théorique : avec le froid prévu, quelles conditions d’exposition sont à vérifier autour des ruchers ?"), kind: "question", seasonal_ids: ["ALM-120"] },
    ];
    draft.regions = regions([
      ["Auvergne-Rhône-Alpes", fact(2, "Les modèles prévoient une séquence de faible pluie dans 92 des 112 PRA évaluables. Sa durée maximale territoriale atteint 4 jours.")],
      ["Occitanie", fact(3, "Les modèles prévoient le franchissement du seuil de gel dans 79 PRA sur 93 évaluables. Le minimum territorial prévu atteint -11,4 °C.")],
      ["Nouvelle-Aquitaine", fact(1, "Les modèles prévoient du gel dans 96 PRA sur 115 évaluables, avec un minimum territorial de -8,4 °C.")],
    ]);
  }
  const validation = validateDraft(draft, briefing, original.illustrations);
  if (validation.status === "rejected") throw new Error(JSON.stringify(validation));
  const originalSelection = original.map_selection;
  if (!originalSelection) throw Error("MAP_SELECTION_MISSING");
  const previousResponse = originalSelection.response;
  const response = {
    ...previousResponse,
    complementary: previousResponse.complementary.slice(0, 1),
    excluded: [...previousResponse.excluded, ...previousResponse.complementary.slice(1)],
  };
  const map_selection = chooseDaily(originalSelection.ranking, originalSelection.maps_sha256, response);
  if (map_selection.response.complementary.length !== 1) throw Error("FIXTURE_MAP_SELECTION");
  const bundle = verifyBundle(JSON.parse(readFileSync(join(dir, original.edition_id + ".json"), "utf8")), original);
  selectedMapIds(map_selection, bundle);
  const view: EditionMapsView = { status: "preview", code: "MAP_REVIEW_REQUIRED", bundle_sha256: bundle.sha256, maps: bundle.maps.map(mapInfo) };
  const edition = { ...original, briefing, draft, validation, map_selection, mode: "simulation", receipt: null };
  writeFileSync(join(dir, "edit08-preview.json"), JSON.stringify({ edition, view }));

  const config = operationalConfig("gpt-6.1-terra");
  const cartography = dailyRequest(originalSelection.ranking);
  const words = (blocks: Block[]) => blocks.map(block => block.text).join(" ").split(/\s+/u).length;
  const before = editorialPayload(original.briefing, original.illustrations, cartography);
  const currentInstructionsBound = inputTokenBound(before, config);
  const after = editorialPayload(briefing, original.illustrations, cartography);
  const volume = (value: string) => ({ json_bytes: Buffer.byteLength(value), gzip_bytes: gzipSync(value).length });
  const bound = inputTokenBound(after, config);
  return {
    date: original.date, edition_id: original.edition_id, snapshot_id: snapshot.id, frozen_input: snapshot.input_archive,
    before: { title: originalHeadline, regions: original.draft.regions.length, article_words: words(original.draft.article), selected_maps: 1 + originalSelection.response.complementary.length,
      ...volume(before), recorded_usage: original.receipt?.usage, recorded_cost_eur: original.receipt?.cost_eur, recorded_duration_ms: original.receipt?.duration_ms },
    after: { title: draft.headline.text, regions: draft.regions.length, article_words: words(draft.article), selected_maps: 1 + map_selection.response.complementary.length,
      ...volume(after), request_bytes: Buffer.byteLength(JSON.stringify(requestBody(after, config))), input_byte_token_bound: bound,
      incremental_input_bytes: Buffer.byteLength(after) - Buffer.byteLength(before),
      incremental_input_cost_bound_eur: cost(bound - currentInstructionsBound, 0, config.pricing),
      briefing_bytes: Buffer.byteLength(JSON.stringify(briefing)), field_computation_ms: computationMs, validation,
      field: agro_field.map(({ indicator, period, maximum, evaluable_pra }) => ({ indicator, period, maximum, evaluable_pra })) },
    replay_duration_ms: Math.round(performance.now() - started), openai_calls: 0, simulation_cost_eur: 0, remote_writes: 0,
  };
}

async function main() {
  const [root, out] = process.argv.slice(2);
  if (!root || !out) throw Error("Usage: edit08_replay.ts <repertoire-captures> <repertoire-resultats>");
  mkdirSync(out, { recursive: true });
  for (const day of ["22", "23"]) {
    const result = await replay(root, day);
    writeFileSync(join(out, `2026-11-${day}.json`), JSON.stringify(result, null, 2) + "\n");
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
