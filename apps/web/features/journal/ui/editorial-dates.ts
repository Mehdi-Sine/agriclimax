// Display only: never apply these transformations to identifiers, URLs or API payloads.
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
function parsed(value: string) {
  const d = new Date(value.length === 10 ? value + "T00:00:00Z" : value);
  if (!Number.isFinite(d.getTime())) throw Error("INVALID_EDITORIAL_DATE");
  return d;
}
export function frenchDate(value: string) {
  return dateFormat.format(parsed(value));
}
export function frenchPeriod(start: string, end: string) {
  const a = parsed(start),
    b = parsed(end);
  if (a.getTime() === b.getTime()) return `le ${frenchDate(start)}`;
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear(),
    sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  const first = sameMonth
    ? String(a.getUTCDate())
    : sameYear
      ? new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        }).format(a)
      : frenchDate(start);
  return `du ${first} au ${frenchDate(end)}`;
}
export function frenchCycle(value: string) {
  const d = parsed(value);
  return `${frenchDate(value)}, ${String(d.getUTCHours()).padStart(2, "0")} h${d.getUTCMinutes() ? ` ${String(d.getUTCMinutes()).padStart(2, "0")}` : ""} UTC`;
}
export function editorialText(text: string) {
  return text
    .replace(
      /du (\d{4}-\d{2}-\d{2}) au (\d{4}-\d{2}-\d{2})/g,
      (_, a: string, b: string) => frenchPeriod(a, b),
    )
    .replace(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)/g,
      (v) => frenchCycle(v),
    )
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, (v) => frenchDate(v));
}
