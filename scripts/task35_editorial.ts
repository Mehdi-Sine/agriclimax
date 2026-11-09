/** Manual local/DEV only. Default simulation. No production storage or scheduler. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { assertBriefing } from "../apps/web/features/editorial/validate";
import { readConfig } from "../apps/web/features/editorial-ai/config";
import { EditorialStore } from "../apps/web/features/editorial-ai/archive";
import { generate } from "../apps/web/features/editorial-ai/generate";
import { verifyModel } from "../apps/web/features/editorial-ai/provider";
const args = process.argv.slice(2);
const arg = (key: string, fallback: string) => {
  const i = args.indexOf(key);
  return i < 0 ? fallback : args[i + 1];
};
async function main() {
  if (args.includes("--live-authorized"))
    throw Error("USE_QUALIFIED_LIVE_COMMAND");
  if (args.includes("--verify-model")) {
    const receipt = await verifyModel(
      process.env.OPENAI_API_KEY ?? "",
      process.env.AGRICLIMAX_EDITORIAL_MODEL ?? "unconfigured",
    );
    console.log(JSON.stringify(receipt));
    return;
  }
  const b: unknown = JSON.parse(
    readFileSync(
      arg("--briefing", "docs/codex/task33/evidence/briefing-example.json"),
      "utf8",
    ),
  );
  assertBriefing(b);
  const config = readConfig();

  // Real generation is only exposed by task35b_live.ts on a qualified persistent host.
  const started = performance.now();
  const a = await generate({
    briefing: b,
    config,
    store: new EditorialStore(arg("--store", "work/task35/archive")),
    mode: "simulation",
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
      quality: "READY_FOR_LIVE_AI_TEST",
      cost_eur: 0,
      cost_known: true,
      input_bytes: Buffer.byteLength(JSON.stringify(b)),
      archive_bytes: Buffer.byteLength(JSON.stringify(a)),
      elapsed_ms: performance.now() - started,
      rss_mib: process.memoryUsage().rss / 1024 ** 2,
    }),
  );
}
main().catch((error) => {
  const code =
    error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "T35_BATCH_FAILED";
  console.error(code);
  console.error(
    "T35_BATCH_FAILED: inspect local run ledger; no automatic paid retry.",
  );
  process.exitCode = 1;
});
