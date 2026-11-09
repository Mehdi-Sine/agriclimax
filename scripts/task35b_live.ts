/** Owner-operated DEV only. No paid workflow/CI/build/import side effect. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkConfig } from "../apps/web/features/editorial-ai/config";
import { assertBriefing } from "../apps/web/features/editorial/validate";
import {
  verifyModel,
  assertModelAccessReceipt,
  openAIProvider,
} from "../apps/web/features/editorial-ai/provider";
import {
  liveConfig,
  shortContextLimit,
  pricingReceipt,
} from "../apps/web/features/editorial-ai/live-pricing";
import {
  budgetReport,
  editorialPayload,
  BudgetRefusal,
} from "../apps/web/features/editorial-ai/budget";
import {
  openPersistentDev,
  initializePersistentDev,
  DEV_ROOT,
} from "../apps/web/features/editorial-ai/persistent-dev";
import {
  approvePreview,
  previewApproved,
} from "../apps/web/features/editorial-ai/preview-approval";
import { generate } from "../apps/web/features/editorial-ai/generate";
import type { Archive } from "../apps/web/features/editorial-ai/model";
let generationCalls = 0;
const args = process.argv.slice(2),
  command = args.shift();
function arg(key: string, fallback?: string) {
  const i = args.indexOf(key);
  return i < 0 ? fallback : args[i + 1];
}
function output(value: unknown) {
  const path = arg("--output");
  if (path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  }
  console.log(JSON.stringify(value));
}
function briefing() {
  const b: unknown = JSON.parse(
    readFileSync(
      arg("--briefing", "docs/codex/task33/evidence/briefing-example.json")!,
      "utf8",
    ),
  );
  assertBriefing(b);
  return b;
}
function config() {
  const n = Number(arg("--max-output-tokens", "6000"));
  if (!Number.isSafeInteger(n) || n < 1000 || n > 6000)
    throw Error("FIRST_TRIAL_OUTPUT_LIMIT");
  const c = liveConfig(arg("--model", "gpt-6.1-terra")!, n);
  c.monthly_budget_eur = Number(process.env.AGRICLIMAX_AI_MONTHLY_BUDGET ?? 5);
  c.max_edition_eur = Number(
    process.env.AGRICLIMAX_AI_MAX_EDITION_COST ?? 0.15,
  );
  checkConfig(c);
  return c;
}
function accessReceipt(model: string) {
  const path = arg("--access-receipt");
  if (!path) throw Error("VERIFY_MODEL_FIRST");
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  assertModelAccessReceipt(value, model);
}
function summarize(a: Archive) {
  return {
    edition_id: a.edition_id,
    archive_checksum: a.checksum,
    mode: a.mode,
    requested_model: a.parameters.model,
    actual_model: a.receipt?.model ?? null,
    response_id: a.receipt?.response_id ?? null,
    edition_date: a.date,
    experimental_historical_reconstruction: true,
    publication_status: a.status,
    validation: a.validation,
    usage: a.receipt?.usage ?? null,
    accounted_cost_upper_eur: a.receipt?.cost_eur ?? null,
    cost_is_invoice: false,
    pricing_version: a.receipt?.pricing_version ?? pricingReceipt.version,
    article_words: a.draft.article
      .map((b) => b.text)
      .join(" ")
      .split(/\s+/u).length,
    preview_approved: previewApproved(DEV_ROOT, a),
    public_publication_enabled: false,
  };
}
async function main() {
  if (
    ![
      "verify-model",
      "estimate",
      "init-store",
      "preflight",
      "generate-once",
      "approve-preview",
      "report",
    ].includes(command ?? "")
  )
    throw Error("UNKNOWN_LIVE_COMMAND");
  if (
    args.includes("--store") ||
    args.includes("--anchor") ||
    args.includes("--comparison-authorized")
  )
    throw Error("STORE_OR_COMPARISON_OVERRIDE_PROHIBITED");
  if (command === "verify-model") {
    const receipt = await verifyModel(
      process.env.OPENAI_API_KEY ?? "",
      arg("--model", "gpt-6.1-terra")!,
    );
    output(receipt);
    return;
  }
  if (command === "init-store") {
    if (!args.includes("--ack-persistent-dev-store"))
      throw Error("PERSISTENT_HOST_OWNER_ACK_REQUIRED");
    output(initializePersistentDev());
    return;
  }
  if (command === "estimate") {
    const b = briefing(),
      c = config(),
      report = budgetReport(editorialPayload(b), c, []);
    output({
      ...report,
      available_month_eur: null,
      accounted_month_eur: null,
      allowed: false,
      financial_state: "not_read_offline_estimate_only",
      bundle_id: b.bundle_id,
      project_access: "not_checked",
      generation_calls: 0,
    });
    return;
  }
  const store = openPersistentDev();
  if (command === "approve-preview" || command === "report") {
    const a = store.read(arg("--edition", "")!);
    if (!a) throw Error("EDITION_ABSENT");
    if (command === "approve-preview") {
      if (!args.includes("--ack-preview-only"))
        throw Error("EXPLICIT_PREVIEW_REVIEW_REQUIRED");
      approvePreview(
        store.root,
        a,
        arg("--checksum", "")!,
        arg("--reviewer", "")!,
      );
      output({
        edition_id: a.edition_id,
        preview_approved: true,
        public_publication_enabled: false,
      });
    } else
      output({
        ...summarize(a),
        run_state: store.readRun(a.edition_id)?.state ?? "missing",
      });
    return;
  }
  const b = briefing(),
    c = config();
  const release = store.lock();
  let report;
  try {
    report = budgetReport(editorialPayload(b), c, store.runs());
  } finally {
    release();
  }
  if (report.input_token_upper_bound > shortContextLimit(c.model))
    throw Error("UNQUALIFIED_LONG_CONTEXT_PRICING");
  if (command === "preflight") {
    output({ ...report, bundle_id: b.bundle_id, generation_calls: 0 });
    return;
  }
  if (process.env.AGRICLIMAX_AI_ENABLED !== "true") throw Error("AI_DISABLED");
  // Explicit owner authorization is tied to the exact real dossier, not key presence.
  if (arg("--authorize-once") !== b.bundle_id)
    throw Error("EXACT_BUNDLE_AUTHORIZATION_REQUIRED");
  accessReceipt(c.model);
  if (!report.allowed) throw new BudgetRefusal(report);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Error("API_KEY_MISSING");
  const archive = await generate({
    briefing: b,
    config: c,
    store,
    mode: "live",
    provider: async (payload, c) => {
      generationCalls++;
      return openAIProvider(key)(payload, c);
    },
  });
  const result = {
      ...summarize(archive),
      run_state: store.readRun(archive.edition_id)?.state ?? "missing",
      generation_calls: generationCalls,
      reused: generationCalls === 0,
    },
    reports = join(DEV_ROOT, "reports");
  mkdirSync(reports, { recursive: true, mode: 0o700 });
  // The immutable source of truth is the T35 archive and financial ledger, not this report copy.
  writeFileSync(
    join(reports, archive.edition_id + ".json"),
    JSON.stringify(result, null, 2) + "\n",
    { mode: 0o600 },
  );
  output(result);
  if (archive.mode !== "live") process.exitCode = 2;
}
main().catch((error) => {
  // Provider bodies, headers and arbitrary exception messages never reach output.
  if (error instanceof BudgetRefusal) {
    output({ error: "BUDGET_EXCEEDED", ...error.report, generation_calls: 0 });
  } else {
    const code =
      error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "LIVE_COMMAND_FAILED";
    output({
      error: code,
      generation_calls: generationCalls,
      automatic_retry: false,
    });
  }
  process.exitCode = 1;
});
