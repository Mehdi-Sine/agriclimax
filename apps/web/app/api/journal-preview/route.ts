import { previewEdition } from "../../../lib/server/editorial-preview";
export async function GET(request: Request) {
  const u = new URL(request.url),
    a = previewEdition(
      u.searchParams.get("date") ?? undefined,
      u.searchParams.get("id") ?? undefined,
    );
  if (!a) return Response.json({ status: "absent" }, { status: 404 });
  const etag = `"${a.checksum}"`;
  if (request.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers: { ETag: etag } });
  return Response.json(a, {
    headers: { ETag: etag, "Cache-Control": "public, max-age=3600" },
  });
}
