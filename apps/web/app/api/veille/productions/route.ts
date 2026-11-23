import { territorialProfiles } from "../../../../lib/server/agro-territorial";

export async function GET(request: Request) {
  const pra = new URL(request.url).searchParams.get("pra");
  if (!pra || !/^pra:(?:[0-9]{5}|2[AB][0-9]{3})$/.test(pra)) {
    return Response.json({ error: "INVALID_PRA" }, { status: 400 });
  }
  const profile = (await territorialProfiles())[pra];
  if (!profile) return Response.json({ error: "UNKNOWN_PRA" }, { status: 404 });
  return Response.json(profile, { headers: { "Cache-Control": "public, max-age=3600" } });
}
