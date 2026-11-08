import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import example from "../../../../docs/codex/task33/evidence/briefing-example.json";
import simulated from "../../../../docs/codex/task35/evidence/simulated-edition.json";
import type { EditorialBriefingBundle } from "../editorial/briefing";
import { hash } from "../editorial/temporal";
import { validateDraft } from "./validate";
import { fallbackDraft } from "./fallback";
import { EditorialStore, verifyArchive } from "./archive";
import { generate } from "./generate";
import { readConfig, cost, type AIConfig } from "./config";
import {
  openAIProvider,
  inputTokenBound,
  requestBody,
  type ProviderResult,
} from "./provider";
import { allBlocks, type EditorialDraft } from "./model";
vi.mock("server-only", () => ({}));
const b = example as unknown as EditorialBriefingBundle;
const d = () => structuredClone(simulated.draft) as EditorialDraft;
const config = (): AIConfig => ({
  ...readConfig({}),
  enabled: true,
  model: "test-model",
  max_edition_eur: 1,
  pricing: {
    version: "test-eur-1",
    model: "test-model",
    verified_at: "2026-11-08",
    input_eur_per_million: 1,
    output_eur_per_million: 5,
  },
});
const roots: string[] = [];
function store() {
  const p = mkdtempSync(join(tmpdir(), "editorial-ai-"));
  roots.push(p);
  return new EditorialStore(p);
}
afterEach(() =>
  roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })),
);
const result = (): ProviderResult => ({
  draft: d(),
  model: "test-model",
  response_id: "test-response",
  usage: { input_tokens: 200, output_tokens: 300, reasoning_tokens: 20 },
});
describe("independent checks across the entire rendered edition", () => {
  it("accepts the real T33 replay with explicit semantic review", () =>
    expect(validateDraft(d(), b).status).toBe("needs_editorial_review"));
  const cases: [string, (v: EditorialDraft) => void, string][] = [
    [
      "invented figure",
      (v) => (v.key_figures[0].value = 987654),
      "FIGURE_MISMATCH",
    ],
    [
      "wrong unit",
      (v) => (v.key_figures[0].unit = "hectares"),
      "FIGURE_MISMATCH",
    ],
    [
      "wrong date",
      (v) => (v.key_figures[0].period[0] = "2026-01-01"),
      "FIGURE_MISMATCH",
    ],
    [
      "unknown region",
      (v) => (v.regions[0].region = "Atlantide"),
      "REGION_REFERENCE",
    ],
    [
      "misattributed PRA",
      (v) => {
        v.key_figures[0].pra_id = "pra:01195";
        v.key_figures[0].scope = "pra";
      },
      "PRA_ATTRIBUTION",
    ],
    [
      "forecast instead of reanalysis",
      (v) => (v.key_figures[0].nature = "forecast"),
      "FIGURE_NATURE",
    ],
    [
      "local extreme as region",
      (v) =>
        (v.article[1].text =
          "Toute la région connaît une moyenne régionale exceptionnelle."),
      "REGIONAL_EXTRAPOLATION",
    ],
    [
      "invented damage",
      (v) => (v.lead.text = "Des dommages agricoles sont constatés."),
      "UNPROVEN_AGRONOMY",
    ],
    [
      "invented yield",
      (v) => (v.article[1].text = "Une perte de rendement est attendue."),
      "UNPROVEN_AGRONOMY",
    ],
    [
      "invented stage",
      (v) => (v.headline.text = "Les cultures sont en floraison."),
      "UNPROVEN_AGRONOMY",
    ],
    [
      "invented sowing",
      (v) => (v.article[1].text = "Les agriculteurs ont semé."),
      "UNPROVEN_AGRONOMY",
    ],
    [
      "unproven causality",
      (v) => (v.article[1].text = "Le froid provoque un retard."),
      "UNPROVEN_AGRONOMY",
    ],
    [
      "unknown publication",
      (v) => (v.news_ids = ["missing"]),
      "DOCUMENTARY_REFERENCE",
    ],
    [
      "weak documentary match",
      (v) => (v.news_ids = [b.documentary.publications[0].id]),
      "DOCUMENTARY_REFERENCE",
    ],
    [
      "documentary confirmation",
      (v) => (v.article[1].text = "La presse confirme le phénomène."),
      "DOCUMENTARY_CONFIRMATION",
    ],
    [
      "missing map",
      (v) => (v.illustration_ids = ["invented-map"]),
      "ILLUSTRATION_CONTEXT",
    ],
    [
      "unsupported factual sentence",
      (v) => (v.article[1].evidence_ids = []),
      "UNSUPPORTED_ASSERTION",
    ],
    [
      "invented text number",
      (v) => (v.article[1].text = "La température atteint 999 °C."),
      "TEXT_NUMBER_OR_DATE",
    ],
    [
      "wrong prose unit",
      (v) => (v.article[1].text = "La température atteint 7 °C."),
      "TEXT_UNIT",
    ],
    [
      "wrong prose region",
      (v) => (v.headline.text = "La pluie revient en Bretagne."),
      "TEXT_REGION",
    ],
    [
      "season as observation",
      (v) => (v.article[2].text = "Les semis sont terminés."),
      "SEASON_AS_OBSERVATION",
    ],
    [
      "invented source",
      (v) => (v.article[1].evidence_ids = ["not-a-fact"]),
      "BLOCK_REFERENCE",
    ],
    [
      "invented contributor",
      (v) => (v.productions[0].production_id = "unprovided"),
      "PRODUCTION_REFERENCE",
    ],
  ];
  for (const [name, mutate, code] of cases)
    it(name, () => {
      const v = d();
      mutate(v);
      expect(validateDraft(v, b).errors).toContain(code);
    });
  it("does not re-label a local sample as national", () => {
    const v = d();
    v.key_figures[0].scope = "national_sample";
    v.key_figures[0].region = null;
    expect(validateDraft(v, b).errors).toContain("FIGURE_SCOPE");
  });
  it("rejects unknown properties", () =>
    expect(validateDraft({ ...d(), extra: true }, b).errors).toContain(
      "DRAFT_CONTRACT",
    ));
  it("checks old history in prose", () => {
    const old = structuredClone(b);
    old.candidates[0].period[1] = "2026-10-29";
    old.bundle_id = hash({ ...old, bundle_id: undefined });
    const v = d();
    v.bundle_id = old.bundle_id;
    v.lead.text = "Aujourd'hui la situation est stable.";
    expect(validateDraft(v, old).errors).toContain("OLD_AS_CURRENT");
  });
  it("qualifies partial support", () => {
    const partial = structuredClone(b);
    partial.national.facts[0].quality_flags.push("partial_support");
    partial.bundle_id = hash({ ...partial, bundle_id: undefined });
    const v = d();
    v.bundle_id = partial.bundle_id;
    v.lead.evidence_ids = [partial.national.facts[0].id];
    expect(validateDraft(v, partial).errors).toContain("UNQUALIFIED_PARTIAL");
  });
  it("never automatically approves unconstrained semantic prose", () => {
    const v = d();
    v.article[1].text = "Une affirmation subtile à contrôler.";
    expect(validateDraft(v, b).review).toContain("SEMANTIC_REVIEW_REQUIRED");
  });
  it("calm day emits a sober fallback without exceptional claims", () => {
    const calm = structuredClone(b);
    calm.candidates = [];
    calm.journal_proposals.headline_candidate_ids = [];
    calm.journal_proposals.regional_candidate_ids = [];
    calm.bundle_id = hash({ ...calm, bundle_id: undefined });
    expect(validateDraft(fallbackDraft(calm), calm).errors).toEqual([]);
    expect(fallbackDraft(calm).main_candidate_id).toBeNull();
  });
  it("keeps every visible field in the block traversal", () =>
    expect(allBlocks(d()).length).toBeGreaterThan(12));
});
describe("single paid request and durable spending controls", () => {
  it("simulates without a key or transport", async () => {
    const provider = vi.fn();
    const a = await generate({
      briefing: b,
      config: config(),
      store: store(),
      mode: "simulation",
      provider,
      simulation: d(),
    });
    expect(provider).not.toHaveBeenCalled();
    expect(a.mode).toBe("simulation");
    expect(a.receipt).toBeNull();
  });
  it("makes exactly one call, reuses completed archives and tracks reasoning within output", async () => {
    const s = store(),
      provider = vi.fn(async () => result()),
      o = {
        briefing: b,
        config: config(),
        store: s,
        mode: "live" as const,
        provider,
      };
    const a = await generate(o);
    expect((await generate(o)).checksum).toBe(a.checksum);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(s.runs()[0].actual_eur).toBe(cost(200, 300, config().pricing));
    expect(a.receipt?.usage.reasoning_tokens).toBe(20);
  });
  it("blocks concurrent callers before provider invocation", async () => {
    const s = store();
    let finish!: (r: ProviderResult) => void;
    const provider = vi.fn(
      () =>
        new Promise<ProviderResult>((r) => {
          finish = r;
        }),
    );
    const o = {
      briefing: b,
      config: config(),
      store: s,
      mode: "live" as const,
      provider,
    };
    const pending = generate(o);
    await expect(generate(o)).rejects.toThrow("CONCURRENT");
    finish(result());
    await pending;
    expect(provider).toHaveBeenCalledTimes(1);
  });
  for (const [name, edit] of [
    ["monthly budget", (c: AIConfig) => (c.monthly_budget_eur = 0.0001)],
    ["edition cap", (c: AIConfig) => (c.max_edition_eur = 0.0001)],
  ] as const)
    it(name, async () => {
      const c = config();
      edit(c);
      const provider = vi.fn();
      await expect(
        generate({
          briefing: b,
          config: c,
          store: store(),
          mode: "live",
          provider,
        }),
      ).rejects.toThrow("BUDGET_EXCEEDED");
      expect(provider).not.toHaveBeenCalled();
    });
  it("blocks missing key/provider", async () => {
    await expect(
      generate({ briefing: b, config: config(), store: store(), mode: "live" }),
    ).rejects.toThrow("API_KEY_OR_PROVIDER_MISSING");
  });
  it("disabled by default", async () => {
    await expect(
      generate({
        briefing: b,
        config: readConfig({}),
        store: store(),
        mode: "live",
      }),
    ).rejects.toThrow("AI_DISABLED");
  });
  it("requires verified tariffs", async () => {
    const c = config();
    c.pricing.version = "unverified";
    await expect(
      generate({ briefing: b, config: c, store: store(), mode: "live" }),
    ).rejects.toThrow("UNVERIFIED");
  });
  it("timeouts never retry and block unrelated spending until reconciliation", async () => {
    const s = store(),
      provider = vi.fn(async () => {
        throw Error("timeout");
      });
    const o = {
      briefing: b,
      config: config(),
      store: s,
      mode: "live" as const,
      provider,
    };
    expect((await generate(o)).mode).toBe("fallback");
    await generate(o);
    const c = config();
    c.model = "another";
    c.pricing.model = "another";
    expect((await generate({ ...o, config: c })).mode).toBe("fallback");
    await expect(
      generate({
        ...o,
        config: c,
        experiment: { id: "retry-comparison", budget_eur: 1 },
      }),
    ).rejects.toThrow("UNRECONCILED");
    expect(provider).toHaveBeenCalledTimes(1);
    expect(s.runs()[0].state).toBe("outcome_unknown");
    expect(s.runs()[0].actual_eur).toBeNull();
  });
  it("rejects malformed output and archives deterministic fallback without another paid request", async () => {
    const s = store(),
      provider = vi.fn(async () => ({ ...result(), draft: { bad: true } }));
    const a = await generate({
      briefing: b,
      config: config(),
      store: s,
      mode: "live",
      provider,
    });
    expect(a.mode).toBe("fallback");
    expect(s.runs()[0].state).toBe("validation_failed");
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("reserves conservatively with a byte upper bound, including strict schema and prompt", () => {
    const c = config(),
      p = JSON.stringify(b);
    expect(inputTokenBound(p, c)).toBeGreaterThan(
      Buffer.byteLength(JSON.stringify(requestBody(p, c))),
    );
  });
  it("crash-left durable running state blocks paid restart", async () => {
    const s = store();
    s.writeRun({
      id: "a".repeat(64),
      month: "2026-11",
      state: "running",
      reserved_eur: 0.1,
      actual_eur: null,
      error: null,
      archive_id: null,
    });
    await expect(
      generate({
        briefing: b,
        config: config(),
        store: s,
        mode: "live",
        provider: async () => result(),
      }),
    ).rejects.toThrow("UNRECONCILED");
  });
});
describe("official structured response adapter, no tools, no retries", () => {
  const body = () => ({
    status: "completed",
    id: "response",
    model: "test-model",
    usage: { input_tokens: 2, output_tokens: 3 },
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(d()) }],
      },
    ],
  });
  it("decodes structured JSON with usage", async () => {
    const fetcher = vi.fn(async () => Response.json(body()));
    const p = openAIProvider("test-key", fetcher);
    expect((await p("{}", config())).draft).toEqual(d());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(requestBody("{}", config()).text.format.strict).toBe(true);
    expect(requestBody("{}", config())).not.toHaveProperty("tools");
  });
  for (const [name, response] of [
    ["malformed", () => new Response("bad")],
    [
      "refusal",
      () =>
        Response.json({
          ...body(),
          output: [{ type: "message", content: [{ type: "refusal" }] }],
        }),
    ],
    [
      "token overflow",
      () => Response.json({ ...body(), status: "incomplete" }),
    ],
    ["provider error", () => new Response("", { status: 503 })],
    ["missing usage", () => Response.json({ ...body(), usage: null })],
  ] as const)
    it(name, async () => {
      const f = vi.fn(async () => response());
      await expect(
        openAIProvider("test-key", f)("{}", config()),
      ).rejects.toThrow("PROVIDER");
      expect(f).toHaveBeenCalledTimes(1);
    });
  it("transport timeout", async () => {
    const f = vi.fn(async () => {
      throw Error("abort");
    });
    await expect(openAIProvider("test-key", f)("{}", config())).rejects.toThrow(
      "TIMEOUT",
    );
    expect(f).toHaveBeenCalledTimes(1);
  });
});
describe("immutable archived reading and revisions", () => {
  it("reads without a provider and rejects tampering", async () => {
    const s = store(),
      a = await generate({
        briefing: b,
        config: config(),
        store: s,
        mode: "simulation",
        simulation: d(),
      });
    expect(s.read(a.edition_id)?.draft).toEqual(d());
    const path = join(s.root, "editions", a.edition_id + ".json"),
      raw = JSON.parse(readFileSync(path, "utf8"));
    raw.draft.headline.text = "changed";
    writeFileSync(path, JSON.stringify(raw));
    expect(() => s.read(a.edition_id)).toThrow("INTEGRITY");
  });
  it("lists dates, absent dates remain absent", async () => {
    const s = store();
    await generate({
      briefing: b,
      config: config(),
      store: s,
      mode: "simulation",
      simulation: d(),
    });
    expect(s.list().filter((a) => a.date === "1999-01-01")).toEqual([]);
    expect(s.list()[0].date).toBe(b.edition_date);
  });
  it("revisions preserve the original", async () => {
    const s = store(),
      o = {
        briefing: b,
        config: config(),
        store: s,
        mode: "simulation" as const,
        simulation: d(),
      },
      a = await generate(o),
      revision = await generate({
        ...o,
        revision: 2,
        supersedes: a.edition_id,
      });
    expect(revision.edition_id).not.toBe(a.edition_id);
    expect(s.read(a.edition_id)?.checksum).toBe(a.checksum);
    expect(revision.supersedes).toBe(a.edition_id);
  });
  it("cannot publish in T35", () => {
    expect(() =>
      verifyArchive({ ...simulated, status: "published" } as never),
    ).toThrow();
  });
});

describe("archived map coherence and daily boundaries", () => {
  it("checks archived maps against the original cycle, period and source", async () => {
    const { default: fixture } =
      await import("../../../../docs/codex/task35/evidence/forecast-edition.json");
    const a = fixture as unknown as import("./model").Archive;
    verifyArchive(a);
    expect(validateDraft(a.draft, a.briefing, a.illustrations).errors).toEqual(
      [],
    );
    const assets = structuredClone(a.illustrations);
    assets[0].period = ["2000-01-01", "2000-01-02"];
    expect(validateDraft(a.draft, a.briefing, assets).errors).toContain(
      "ILLUSTRATION_CONTEXT",
    );
  });
  it("observation wording cannot disguise forecast facts", async () => {
    const { default: fixture } =
      await import("../../../../docs/codex/task35/evidence/forecast-edition.json");
    const a = fixture as unknown as import("./model").Archive;
    const v = structuredClone(a.draft);
    v.lead.text = "Le froid observé concerne les territoires.";
    expect(validateDraft(v, a.briefing, a.illustrations).errors).toContain(
      "FORECAST_AS_OBSERVATION",
    );
  });
  it("changing model config does not rebill a daily dossier", async () => {
    const s = store(),
      provider = vi.fn(async () => result()),
      o = {
        briefing: b,
        config: config(),
        store: s,
        mode: "live" as const,
        provider,
      };
    const a = await generate(o),
      c = config();
    c.max_output_tokens = 7000;
    expect((await generate({ ...o, config: c })).edition_id).toBe(a.edition_id);
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("comparison calls require their own explicit capped allowance", async () => {
    const provider = vi.fn(async () => result());
    await expect(
      generate({
        briefing: b,
        config: config(),
        store: store(),
        mode: "live",
        provider,
        experiment: { id: "test-comparison", budget_eur: 0.00001 },
      }),
    ).rejects.toThrow("EXPERIMENT_BUDGET");
    expect(provider).not.toHaveBeenCalled();
  });
});
