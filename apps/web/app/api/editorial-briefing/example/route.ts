import example from "../../../../../../docs/codex/task33/evidence/briefing-example.json";
import { assertBriefing } from "../../../../features/editorial/validate";
// Static historical replay, built once by the manual T33 batch. No national computation per request.
export async function GET(request: Request) {
  assertBriefing(example);
  const etag = `"${example.bundle_id}"`;
  const headers = {
    ETag: etag,
    "Cache-Control": "public, max-age=3600",
    "X-Editorial-Example": "historical-replay",
  };
  if (request.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return Response.json(example, { headers });
}
