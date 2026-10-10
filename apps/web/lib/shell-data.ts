import type { DemoMapCollection } from "./repositories";

/** UI boundary: live results are never relabelled as demo fixtures. */
export type ShellData =
  | { mode: "demo"; collection: DemoMapCollection }
  | { mode: "live"; state: "missing" | "available"; count: number }
  | { mode: "live"; state: "source-error"; message: string };

export function liveMapSummary(count: number): ShellData {
  return { mode: "live", state: count === 0 ? "missing" : "available", count };
}
