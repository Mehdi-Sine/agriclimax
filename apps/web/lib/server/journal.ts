import "server-only";
import { nationalWatch } from "./national-watch";
import {
  buildEdition,
  JOURNAL_VERSION,
  type JournalEdition,
} from "../../features/journal/model";
import { assertEdition } from "../../features/journal/validate";
import {
  createRegistry,
  defaultContributors,
} from "../../features/journal/registry";
import { WheatEditorialContributor } from "../../features/wheat/editorial";
import { latestWheatForecast } from "./wheat";
import { WHEAT_VERSION } from "../../features/wheat/qualified";
const cache = new Map<string, JournalEdition>();
export async function journal(run?: string) {
  const summary = await nationalWatch(run),
    key = `${summary.identity}/${JOURNAL_VERSION}/${WHEAT_VERSION}`;
  let edition = cache.get(key);
  if (!edition) {
    // Bounded fail-open enrichment. Archive fetches already enforce a 12s request timeout.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const snapshots = await Promise.race([
      latestWheatForecast(summary.run).catch(() => []),
      new Promise<never[]>((resolve) => {
        timer = setTimeout(() => resolve([]), 1500);
        timer.unref();
      }),
    ]).finally(() => clearTimeout(timer));
    const registry = createRegistry([
      ...defaultContributors.filter((c) => c.id !== "wheat"),
      WheatEditorialContributor(snapshots),
    ]);
    edition = buildEdition(summary, {
      now: new Date().toISOString(),
      registry,
    });
    assertEdition(edition);
    if (cache.size >= 3) cache.delete(cache.keys().next().value!);
    if (snapshots.length) cache.set(key, edition);
  }
  // Freshness depends on consultation time, never on the cached generation time.
  const age = Date.now() - Date.parse(summary.run),
    expired = summary.period[1] < new Date().toISOString().slice(0, 10);
  return {
    ...edition,
    data_freshness: expired
      ? ("expired" as const)
      : age > 36 * 3600000
        ? ("stale" as const)
        : ("fresh" as const),
  };
}
