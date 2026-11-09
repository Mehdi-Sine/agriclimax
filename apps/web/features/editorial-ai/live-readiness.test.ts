import { it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import { verifyModel, requestBody } from "./provider";
import { liveConfig, pricingReceipt } from "./live-pricing";
import { budgetReport, editorialPayload, BudgetRefusal } from "./budget";
import {
  assertPersistentHost,
  DEV_ROOT,
  initializePersistentDev,
  openPersistentDev,
} from "./persistent-dev";
import { approvePreview, previewApproved } from "./preview-approval";
import { EditorialStore, sealArchive, verifyArchive } from "./archive";
import { checkConfig } from "./config";
import fixture from "../../../../docs/codex/task35/evidence/simulated-edition.json";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const roots: string[] = [];
const temp = () => {
  const path = mkdtempSync(join(tmpdir(), "live-editorial-"));
  roots.push(path);
  return path;
};
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
const date = new Date("2026-11-09T06:00:00Z");
const c = () => liveConfig("gpt-6.1-terra", 6000, date);
const getArchive = () => {
  const value: unknown = structuredClone(fixture);
  verifyArchive(value);
  return value;
};
const briefing = getArchive().briefing;
it("read-only verification has exactly one GET, no generation, and no secret in the receipt", async () => {
  const transport = vi.fn(async () => Response.json({ id: "gpt-6.1-terra" }));
  const r = await verifyModel(
    "unit-test-private-value",
    "gpt-6.1-terra",
    transport,
  );
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, options] = transport.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe("https://api.openai.com/v1/models/gpt-6.1-terra");
  expect(options.method ?? "GET").toBe("GET");
  expect(r.generation_calls).toBe(0);
  expect(JSON.stringify(r)).not.toContain("unit-test-private-value");
});
for (const [status, error] of [
  [401, "AUTHENTICATION"],
  [403, "FORBIDDEN"],
  [404, "NOT_ACCESSIBLE"],
  [429, "HTTP_429"],
] as const)
  it(`verifier sanitizes ${status} without retry`, async () => {
    const transport = vi.fn(async () =>
      Response.json(
        { error: { message: "sensitive provider payload" } },
        { status },
      ),
    );
    await expect(
      verifyModel("unit-private", "gpt-6-luna", transport),
    ).rejects.toThrow(error);
    expect(transport).toHaveBeenCalledTimes(1);
  });
it("verification rejects malformed responses, invalid identifiers and missing keys", async () => {
  await expect(verifyModel("", "gpt-6-luna")).rejects.toThrow(
    "API_KEY_MISSING",
  );
  await expect(verifyModel("unit", "../leak")).rejects.toThrow("INVALID_MODEL");
  await expect(
    verifyModel("unit", "gpt-6-luna", async () =>
      Response.json({ id: "other" }),
    ),
  ).rejects.toThrow("MISMATCH");
});
it("availability is independent of generation enablement and pricing", async () => {
  vi.stubEnv("AGRICLIMAX_AI_ENABLED", "true");
  vi.stubEnv("AGRICLIMAX_AI_INPUT_EUR_PER_MILLION", "");
  expect(
    await verifyModel("unit", "gpt-6-luna", async () =>
      Response.json({ id: "gpt-6-luna" }),
    ),
  ).toHaveProperty("available", true);
});
it("uses current official USD rates with conservative euro and regional bounds", () => {
  expect(c().pricing.input_eur_per_million).toBeCloseTo(1.1);
  expect(c().pricing.output_eur_per_million).toBeCloseTo(5.5);
  expect(
    liveConfig("gpt-6-luna", 6000, date).pricing.input_eur_per_million,
  ).toBeCloseTo(0.11);
  expect(pricingReceipt.eur_per_usd_ceiling).toBeGreaterThan(
    1 / pricingReceipt.fx.usd_per_eur,
  );
});
it("rejects stale tariffs and unknown candidate models", () => {
  expect(() =>
    liveConfig("gpt-6.1-terra", 6000, new Date("2026-12-01")),
  ).toThrow("REVERIFICATION");
  expect(() => liveConfig("unverified-model", 6000, date)).toThrow(
    "NOT_QUALIFIED",
  );
});
it("pins Standard processing and explicit-only cache with no breakpoints or tools", () => {
  const request = requestBody(editorialPayload(briefing), c());
  expect(request).toMatchObject({
    service_tier: "default",
    store: false,
    prompt_cache_options: { mode: "explicit", ttl: "30m" },
    reasoning: { effort: "low" },
    text: { format: { strict: true, type: "json_schema" } },
  });
  expect(JSON.stringify(request)).not.toContain("prompt_cache_breakpoint");
  expect(request).not.toHaveProperty("tools");
});
it("keeps every strict schema object closed and all its fields required", () => {
  const schema = requestBody("{}", c()).text.format.schema;
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    const v = value as Record<string, unknown>;
    if (v.type === "object") {
      expect(v.additionalProperties).toBe(false);
      expect(v.required).toEqual(Object.keys(v.properties as object));
    }
    Object.values(v).forEach((x) =>
      Array.isArray(x) ? x.forEach(visit) : visit(x),
    );
  }
  visit(schema);
});
it("reserves under 0.15 EUR on the real dossier with no fixture prices", () => {
  const r = budgetReport(
    editorialPayload(briefing),
    c(),
    [],
    "2026-11-09T06:00:00Z",
  );
  expect(r.allowed).toBe(true);
  expect(r.input_token_upper_bound).toBeGreaterThan(82000);
  expect(r.reserved_eur).toBeLessThanOrEqual(0.15);
  expect(r.pricing_version).toBe(pricingReceipt.version);
});
it("reports the exact budget blockers and keeps uncertain reservations charged", () => {
  const r = budgetReport(
    editorialPayload(briefing),
    c(),
    [
      {
        id: "a".repeat(64),
        month: "2026-11",
        state: "outcome_unknown",
        reserved_eur: 4.99,
        actual_eur: null,
        error: null,
        archive_id: null,
      },
    ],
    "2026-11-09T06:00:00Z",
  );
  expect(r.blockers).toContain("MONTHLY_BUDGET_EXCEEDED");
  expect(r.blockers).toContain("UNRECONCILED_GENERATION");
  expect(r.available_month_eur).toBeCloseTo(0.01);
  expect(new BudgetRefusal(r).report).toEqual(r);
});
it("edition cost and non-finite limits cannot be raised", () => {
  for (const value of [1, NaN, Infinity])
    expect(() => checkConfig({ ...c(), max_edition_eur: value })).toThrow(
      "INVALID_AI_CONFIG",
    );
});
it("a fresh store instance preserves committed monthly spending", () => {
  const root = temp(),
    s = new EditorialStore(root);
  s.writeRun({
    id: "a".repeat(64),
    month: "2026-11",
    state: "completed",
    reserved_eur: 0.14,
    actual_eur: 0.1,
    error: null,
    archive_id: null,
  });
  expect(
    budgetReport(
      "{}",
      c(),
      new EditorialStore(root).runs(),
      "2026-11-09T06:00:00Z",
    ).accounted_month_eur,
  ).toBe(0.1);
});
it("corrupt financial amounts fail closed", () => {
  const root = temp(),
    s = new EditorialStore(root);
  writeFileSync(
    join(root, "runs", "a".repeat(64) + ".json"),
    JSON.stringify({
      id: "a".repeat(64),
      month: "2026-11",
      state: "completed",
      reserved_eur: -1,
      actual_eur: null,
    }),
  );
  expect(() => s.runs()).toThrow("CORRUPT_FINANCIAL_LEDGER");
});
const facts = {
  platform: "linux",
  ci: false,
  fs_type: 0xef53,
  root_real: DEV_ROOT,
  anchor_parent_real: "/var/lib/agriclimax-ai",
};
it("qualifies the fixed persistent Linux location", () =>
  expect(() => assertPersistentHost(facts)).not.toThrow());
for (const edit of [
  { ci: true },
  { fs_type: 0x794c7630 },
  { fs_type: 0x01021994 },
  { root_real: "/tmp/fresh-budget" },
  { platform: "darwin" },
  { anchor_parent_real: "/workspace" },
])
  it(
    "rejects ephemeral, unsupported, or redirected financial storage " +
      JSON.stringify(edit),
    () => expect(() => assertPersistentHost({ ...facts, ...edit })).toThrow(),
  );
it("both initialize and paid opening reject CI before filesystem writes", () => {
  vi.stubEnv("GITHUB_ACTIONS", "true");
  expect(() => initializePersistentDev()).toThrow("EPHEMERAL");
  expect(() => openPersistentDev()).toThrow("EPHEMERAL");
});
it("explicit preview approval preserves archive immutability and does not approve public publication", async () => {
  const root = temp(),
    { checksum: oldChecksum, ...body } = getArchive();
  void oldChecksum;
  // Synthetic provider receipt is confined to this unit test, never a Preview deliverable.
  const a = sealArchive({
    ...body,
    mode: "live",
    parameters: { ...body.parameters, model: "unit-provider" },
    receipt: {
      model: "unit-provider",
      response_id: "unit-test-response",
      usage: { input_tokens: 1, output_tokens: 1, reasoning_tokens: 0 },
      cost_eur: 0.01,
      duration_ms: 1,
      pricing_version: "unit-test-only",
    },
  });
  const store = new EditorialStore(root);
  store.save(a);
  vi.stubEnv("AGRICLIMAX_AI_PREVIEW_ARCHIVE_DIR", root);
  const { previewEditions } =
    await import("../../lib/server/editorial-preview");
  expect(previewEditions()).toEqual([]);
  expect(previewApproved(root, a)).toBe(false);
  approvePreview(root, a, a.checksum, "unit-test-reviewer");
  expect(previewApproved(root, a)).toBe(true);
  expect(previewEditions().map((x) => x.edition_id)).toEqual([a.edition_id]);
  expect(a.status).toBe("needs_editorial_review");
  const receipt = JSON.parse(
    readFileSync(
      join(root, "preview-approvals", a.edition_id + ".json"),
      "utf8",
    ),
  );
  expect(receipt.preview_only).toBe(true);
  expect(previewApproved(root, { ...a, checksum: "0".repeat(64) })).toBe(false);
});
it("refuses to pass a simulation off as an approved real article", () => {
  expect(() =>
    approvePreview(temp(), getArchive(), fixture.checksum, "reviewer"),
  ).toThrow("REVIEWED_LIVE_ARCHIVE");
});
it("legacy live CLI cannot reset the paid budget using --store", () => {
  const r = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "node_modules/tsx/dist/cli.mjs",
      "../../scripts/task35_editorial.ts",
      "--live-authorized",
      "--store",
      temp(),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_OPTIONS: "--conditions=react-server",
        OPENAI_API_KEY: "unit-private-value",
      },
      encoding: "utf8",
    },
  );
  expect(r.status).not.toBe(0);
  expect(r.stderr).toContain("USE_QUALIFIED_LIVE_COMMAND");
  expect(r.stdout + r.stderr).not.toContain("unit-private-value");
});

it("access verification expires independently of tariff validity", async () => {
  const { assertModelAccessReceipt } = await import("./provider");
  const receipt = {
    version: "openai-model-access-1",
    model: "gpt-6.1-terra",
    available: true,
    generation_calls: 0,
    verified_at: "2026-11-09T05:00:00Z",
  };
  expect(() =>
    assertModelAccessReceipt(receipt, "gpt-6.1-terra", date),
  ).not.toThrow();
  for (const now of [new Date("2026-11-11"), new Date("2026-11-08")])
    expect(() =>
      assertModelAccessReceipt(receipt, "gpt-6.1-terra", now),
    ).toThrow("EXPIRED");
  expect(() => assertModelAccessReceipt(receipt, "gpt-6-luna", date)).toThrow(
    "MISMATCH",
  );
});
it("an incomplete paid response preserves actual usage but never retries automatically", async () => {
  const { openAIProvider } = await import("./provider"),
    { generate } = await import("./generate");
  const root = temp(),
    store = new EditorialStore(root);
  const transport = vi.fn(async () =>
    Response.json({
      id: "unit-response",
      model: "gpt-6.1-terra",
      status: "incomplete",
      usage: {
        input_tokens: 100,
        output_tokens: 6000,
        output_tokens_details: { reasoning_tokens: 100 },
      },
      output: [],
    }),
  );
  const provider = openAIProvider("unit-private", transport);
  const options = {
    briefing,
    config: c(),
    store,
    mode: "live" as const,
    provider,
  };
  const a = await generate(options);
  expect(a.mode).toBe("fallback");
  expect(a.receipt?.usage.output_tokens).toBe(6000);
  expect(a.receipt?.cost_eur).toBeGreaterThan(0);
  expect(store.runs()[0].state).toBe("outcome_unknown");
  await generate(options);
  expect(transport).toHaveBeenCalledTimes(1);
});
