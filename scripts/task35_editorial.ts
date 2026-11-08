/** Manual local/DEV only. Default simulation. No production storage or scheduler. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { assertBriefing } from "../apps/web/features/editorial/validate";
import { readConfig } from "../apps/web/features/editorial-ai/config";
import { EditorialStore } from "../apps/web/features/editorial-ai/archive";
import { generate } from "../apps/web/features/editorial-ai/generate";
import {
  openAIProvider,
  verifyModel,
} from "../apps/web/features/editorial-ai/provider";
const args = process.argv.slice(2);
const arg = (key: string, fallback: string) => {
  const i = args.indexOf(key);
  return i < 0 ? fallback : args[i + 1];
};
async function main() {
  const b: unknown = JSON.parse(
    readFileSync(
      arg("--briefing", "docs/codex/task33/evidence/briefing-example.json"),
      "utf8",
    ),
  );
  assertBriefing(b);
  const live = args.includes("--live-authorized"),
    config = readConfig();
  let provider;
  if (args.includes("--verify-model")) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw Error("API_KEY_MISSING");
    await verifyModel(key, config.model);
    console.log(
      JSON.stringify({
        model: config.model,
        available: true,
        generation_calls: 0,
      }),
    );
    return;
  }
  if (live) {
    if (!config.enabled) throw Error("AI_DISABLED");
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw Error("API_KEY_MISSING");
    provider = openAIProvider(key);
  }
  const started = performance.now();
  const a = await generate({
    briefing: b,
    config,
    store: new EditorialStore(arg("--store", "work/task35/archive")),
    mode: live ? "live" : "simulation",
    provider,
    experiment: args.includes("--comparison-authorized")
      ? {
          id: arg("--experiment-id", ""),
          budget_eur: Number(arg("--experiment-budget", "0")),
        }
      : undefined,
    revision: Number(arg("--revision", "1")),
    supersedes: args.includes("--supersedes")
      ? arg("--supersedes", "")
      : undefined,
    simulation: args.includes("--response")
      ? JSON.parse(readFileSync(arg("--response", ""), "utf8"))
      : undefined,
  });
  const output = arg("--output", "work/task35/edition.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(a, null, 2) + "\n");
  console.log(
    JSON.stringify({
      edition_id: a.edition_id,
      status: a.status,
      mode: a.mode,
      quality: live ? "REQUIRES_EDITORIAL_REVIEW" : "READY_FOR_LIVE_AI_TEST",
      cost_eur: a.receipt?.cost_eur ?? (live ? null : 0),
      cost_known: !live || a.receipt !== null,
      input_bytes: Buffer.byteLength(JSON.stringify(b)),
      archive_bytes: Buffer.byteLength(JSON.stringify(a)),
      elapsed_ms: performance.now() - started,
      rss_mib: process.memoryUsage().rss / 1024 ** 2,
    }),
  );
}
main().catch(() => {
  console.error(
    "T35_BATCH_FAILED: inspect local run ledger; no automatic paid retry.",
  );
  process.exitCode = 1;
});
