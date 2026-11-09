import "server-only";
import { hash } from "../editorial/temporal";
import { assertBriefing } from "../editorial/validate";
import type { EditorialBriefingBundle } from "../editorial/briefing";
import {
  ENGINE,
  PROMPT_VERSION,
  CONFIG_VERSION,
  type Archive,
  type Illustration,
} from "./model";
import { checkConfig, cost, type AIConfig } from "./config";
import { sealArchive, type Run, type GenerationStore } from "./archive";
import { validateDraft, assertDraft } from "./validate";
import { fallbackDraft } from "./fallback";
import { ProviderFailure, type Provider } from "./provider";
import { BudgetRefusal, budgetReport, editorialPayload } from "./budget";
import { INSTRUCTIONS } from "./prompt";
export interface GenerateOptions {
  briefing: EditorialBriefingBundle;
  config: AIConfig;
  store: GenerationStore;
  mode: "simulation" | "live";
  provider?: Provider;
  simulation?: unknown;
  illustrations?: Illustration[];
  now?: string;
  revision?: number;
  supersedes?: string;
  experiment?: { id: string; budget_eur: number };
}
export async function generate(o: GenerateOptions): Promise<Archive> {
  const b = o.briefing,
    c = o.config;
  assertBriefing(b);
  if (
    o.experiment &&
    (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(o.experiment.id) ||
      o.experiment.id === "daily")
  )
    throw Error("INVALID_EXPERIMENT_ID");
  if ((o.revision ?? 1) === 1 && o.supersedes)
    throw Error("REVISION_PARENT_UNEXPECTED");
  const revision = o.revision ?? 1,
    assets = o.illustrations ?? [];
  const id = hash([
    b.edition_date,
    b.bundle_id,
    PROMPT_VERSION,
    c.model,
    CONFIG_VERSION,
    hash(c),
    o.mode,
    revision,
    o.supersedes ?? null,
    o.experiment?.id ?? "daily",
  ]);
  const release = await o.store.lock();
  try {
    const prior = await o.store.readRun(id);
    if (prior) {
      if (prior.archive_id) {
        const archive = await o.store.read(prior.archive_id);
        if (archive) return archive;
      }
      throw Error("ALREADY_ATTEMPTED_RECONCILIATION_REQUIRED");
    }
    if (o.mode === "live" && !o.experiment && revision === 1) {
      const existing = (await o.store.runs())
        .find(
          (r) =>
            r.edition_date === b.edition_date &&
            r.scope === "daily" &&
            r.archive_id,
        );
      if (existing) {
        const archive = await o.store.read(existing.archive_id!);
        if (archive?.briefing.bundle_id === b.bundle_id) return archive;
        throw Error("DAILY_EDITION_EXISTS_USE_REVISION");
      }
    }
    if (revision !== 1) {
      const parent = o.supersedes ? await o.store.read(o.supersedes) : null;
      if (
        !parent ||
        parent.date !== b.edition_date ||
        revision !== parent.revision + 1
      )
        throw Error("REVISION_PARENT_REQUIRED");
    }
    const now = o.now ?? new Date().toISOString(),
      month = now.slice(0, 7);
    const payload = editorialPayload(b, assets);
    const run: Run = {
      edition_date: b.edition_date,
      scope: o.experiment?.id ?? "daily",
      id,
      month,
      state: "not_started",
      reserved_eur: 0,
      actual_eur: null,
      error: null,
      archive_id: null,
    };
    if (o.mode === "live") {
      checkConfig(c);
      if (!o.provider) throw Error("API_KEY_OR_PROVIDER_MISSING");
      const runs = await o.store.runs();
      if (
        runs.some((r) =>
          ["running", "reserved", "outcome_unknown"].includes(r.state),
        )
      )
        throw Error("UNRECONCILED_GENERATION");
      const report = budgetReport(payload, c, runs, now);
      const bound = report.reserved_eur;
      if (o.experiment) {
        const spent = runs
          .filter((r) => r.month === month && r.scope === o.experiment!.id)
          .reduce((s, r) => s + (r.actual_eur ?? r.reserved_eur), 0);
        if (
          !Number.isFinite(o.experiment.budget_eur) ||
          o.experiment.budget_eur <= 0 ||
          spent + bound > o.experiment.budget_eur
        )
          throw Error("EXPERIMENT_BUDGET_EXCEEDED");
      }
      const used = runs
        .filter((r) => r.month === month)
        .reduce((s, r) => s + (r.actual_eur ?? r.reserved_eur), 0);
      if (bound > c.max_edition_eur || used + bound > c.monthly_budget_eur) {
        run.state = "budget_exceeded";
        run.error = "BUDGET_EXCEEDED";
        if (!o.store.reserveAtomic) await o.store.writeRun(run);
        throw new BudgetRefusal(report);
      }
      run.state = "reserved";
      run.reserved_eur = bound;
      if (o.store.reserveAtomic) await o.store.reserveAtomic(run);
      else await o.store.writeRun(run);
    }
    let draft: unknown = o.simulation ?? fallbackDraft(b),
      receipt: Archive["receipt"] = null,
      mode: Archive["mode"] = o.mode;
    if (o.mode === "live") {
      run.state = "running";
      await o.store.writeRun(run);
      const started = performance.now();
      try {
        const result = await o.provider!(payload, c);
        const actual = cost(
          result.usage.input_tokens,
          result.usage.output_tokens,
          c.pricing,
        );
        if (
          result.model !== c.model ||
          !result.response_id ||
          Object.values(result.usage).some(
            (v) => !Number.isSafeInteger(v) || v < 0,
          ) ||
          actual > run.reserved_eur ||
          result.usage.output_tokens > c.max_output_tokens
        )
          throw Error("USAGE_EXCEEDS_RESERVATION");
        receipt = {
          model: result.model,
          response_id: result.response_id,
          usage: result.usage,
          cost_eur: actual,
          duration_ms: Math.round(performance.now() - started),
          pricing_version: c.pricing.version,
        };
        run.actual_eur = actual;
        draft = result.draft;
      } catch (error) {
        // Never assume an unparseable or interrupted request was free. Keep reservation charged.
        run.state = "outcome_unknown";
        run.error =
          error instanceof ProviderFailure
            ? error.code
            : "PROVIDER_OUTCOME_REQUIRES_RECONCILIATION";
        if (error instanceof ProviderFailure && error.evidence) {
          const e = error.evidence;
          const accounted = cost(
            e.usage.input_tokens,
            e.usage.output_tokens,
            c.pricing,
          );
          if (
            e.model === c.model &&
            Object.values(e.usage).every(
              (v) => Number.isSafeInteger(v) && v >= 0,
            ) &&
            accounted <= run.reserved_eur
          ) {
            receipt = {
              model: e.model,
              response_id: e.response_id,
              usage: e.usage,
              cost_eur: accounted,
              duration_ms: Math.round(performance.now() - started),
              pricing_version: c.pricing.version,
            };
            run.actual_eur = accounted;
          }
          await o.store.diagnostic(id, {
            provider_error: run.error,
            evidence: e,
            receipt,
          });
        }
        await o.store.writeRun(run);
        draft = fallbackDraft(b);
        mode = "fallback";
      }
    }
    let validation = validateDraft(draft, b, assets);
    if (validation.status === "rejected") {
      run.error = "DRAFT_REJECTED:" + validation.errors.join(",");
      run.state = "validation_failed";
      // Retain rejected payload separately for diagnosis, never render it.
      await o.store.diagnostic(id, { draft, validation, receipt });
      draft = fallbackDraft(b);
      validation = validateDraft(draft, b);
      mode = "fallback";
    }
    assertDraft(draft);
    const archive = sealArchive({
      version: "editorial-archive-1",
      edition_id: id,
      revision,
      supersedes: o.supersedes ?? null,
      date: b.edition_date,
      generated_at: now,
      engine: ENGINE,
      prompt_version: PROMPT_VERSION,
      config_version: CONFIG_VERSION,
      mode,
      status: validation.status,
      draft,
      briefing: b,
      illustrations: mode === "fallback" ? [] : assets,
      validation,
      receipt,
      prompt_sha256: hash(INSTRUCTIONS),
      parameters: {
        model: c.model,
        max_output_tokens: c.max_output_tokens,
        ...(c.request_profile ? { request_profile: c.request_profile } : {}),
      },
    });
    await o.store.save(archive);
    if (!["outcome_unknown", "validation_failed"].includes(run.state))
      run.state = "completed";
    run.archive_id = id;
    await o.store.writeRun(run);
    return archive;
  } finally {
    await release();
  }
}
