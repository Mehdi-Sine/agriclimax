import { previewEdition } from "../../../../lib/server/editorial-preview";
export async function GET(request: Request) {
  const u = new URL(request.url),
    a = previewEdition(undefined, u.searchParams.get("id") ?? ""),
    map = a?.illustrations.find(
      (m) =>
        m.id === u.searchParams.get("map") &&
        a.draft.illustration_ids.includes(m.id),
    );
  if (!map)
    return Response.json(
      { status: "absent", message: "Aucune carte archivée compatible." },
      { status: 404 },
    );
  return Response.json(map.data, {
    headers: {
      ETag: `"${map.sha256}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
