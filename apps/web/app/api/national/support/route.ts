import {
  supportDocument,
  validSupportQuery,
  periodSupportDocument,
} from "../../../../lib/server/spatial-restitution";
import {
  isCalendarDate,
  calendarDays,
} from "../../../../features/national/daily-availability";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  if (p.has("start") || p.has("end")) {
    const start = p.get("start") ?? "",
      end = p.get("end") ?? "",
      variable = p.get("variable") ?? "";
    if (
      [...p.keys()].some(
        (k) =>
          !["start", "end", "variable"].includes(k) || p.getAll(k).length !== 1,
      ) ||
      !calendarDays(start, end).length ||
      calendarDays(start, end).length > 30 ||
      !["temperature", "precipitation"].includes(variable)
    )
      return Response.json({ error: "INVALID_QUERY" }, { status: 400 });
    return Response.json(await periodSupportDocument(start, end, variable), {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }
  if (!validSupportQuery(p) || !isCalendarDate(p.get("date")!))
    return Response.json({ error: "INVALID_QUERY" }, { status: 400 });
  return Response.json(
    await supportDocument(p.get("date")!, p.get("variable")!),
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
