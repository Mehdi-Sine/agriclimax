import { createHash } from "node:crypto";
import { isJournalRun } from "../../../../features/journal/query";
import {
  journalMapData,
  mapTheme,
} from "../../../../features/journal/ui/map-data";
import { nationalWatch } from "../../../../lib/server/national-watch";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams,
    run = params.get("run"),
    phenomenon = params.get("phenomenon");
  try {
    if (
      !run ||
      !run.includes("T") ||
      !isJournalRun(run) ||
      !phenomenon ||
      [...params.keys()].some(
        (k) =>
          !["run", "phenomenon"].includes(k) || params.getAll(k).length !== 1,
      )
    )
      throw Error();
    mapTheme(phenomenon);
  } catch {
    return Response.json({ error: "INVALID_QUERY" }, { status: 400 });
  }
  try {
    const summary = await nationalWatch(run);
    if (Date.parse(summary.run) !== Date.parse(run)) throw Error();
    const body = JSON.stringify(journalMapData(summary, phenomenon));
    const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
    const headers = {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      ETag: etag,
    };
    return request.headers.get("if-none-match") === etag
      ? new Response(null, { status: 304, headers })
      : new Response(body, {
          headers: { ...headers, "Content-Type": "application/json" },
        });
  } catch {
    return Response.json(
      { error: "ARCHIVED_JOURNAL_MAP_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
