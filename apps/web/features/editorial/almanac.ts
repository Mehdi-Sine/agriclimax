import { createHash } from "node:crypto";
import master from "../../../../config/almanach/agriclimax-almanach.v1.json";
import receipt from "../../../../config/almanach/provenance.v1.json";
import { isCalendarDate } from "../national/daily-availability";
export const ALMANAC_VERSION = master.meta.version;
export const almanac = master;
export const almanacReceipt = receipt;
export const split = (s: string) =>
  s
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
export const productionOptions = [
  ...new Set(master.fenetres.flatMap((w) => split(w.production))),
].sort();
export const regionOptions = master.profils_regionaux.map((r) => r.region);
export function parisDate(value: string): string {
  if (isCalendarDate(value)) return value;
  if (
    !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw Error("EDITORIAL_DATE");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export function inWindow(mmdd: string, start: string, end: string) {
  return start <= end
    ? mmdd >= start && mmdd <= end
    : mmdd >= start || mmdd <= end;
}
export function easter(year: number): string {
  // Gregorian computus (Meeus/Jones/Butcher); civil date, no lunar-weather inference.
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    n = h + l - 7 * m + 114;
  return `${year}-${String(Math.floor(n / 31)).padStart(2, "0")}-${String((n % 31) + 1).padStart(2, "0")}`;
}
export interface SeasonalCandidate {
  id: string;
  category: string;
  title: string;
  question: string;
  productions: string[];
  region_scope: string;
  signal_ids: string[];
  source_ids: string[];
  confidence: string;
  requires_verification: boolean;
  publication_eligible: false;
  reserve: string;
}
export function getSeasonalEditorialContext(
  input: string,
  region?: string,
  production?: string,
  limit = 12,
) {
  const date = parisDate(input),
    mmdd = date.slice(5),
    year = Number(date.slice(0, 4));
  if (region && !regionOptions.includes(region)) throw Error("ALMANAC_REGION");
  if (production && !productionOptions.includes(production))
    throw Error("ALMANAC_PRODUCTION");
  if (!Number.isInteger(limit) || limit < 1 || limit > 40)
    throw Error("ALMANAC_BUDGET");
  const day = master.jours.find((d) => d.date_mm_jj === mmdd);
  const profile = master.profils_regionaux.find((r) => r.region === region);
  // A regional profile is context, never proof of presence. Retain national windows and mark scope indicative.
  const active = master.fenetres
    .filter(
      (w) =>
        inWindow(mmdd, w.start, w.end) &&
        (!region ||
          !regionOptions.some((r) => w.zone.includes(r)) ||
          w.zone.includes(region)) &&
        (!production ||
          split(w.production).includes(production) ||
          w.production === "Toutes productions"),
    )
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const windows: SeasonalCandidate[] = active.slice(0, limit).map((w) => ({
    id: w.id,
    category: w.category,
    title: w.title,
    question: w.angle,
    productions: split(w.production),
    region_scope: region
      ? `${region} — contexte indicatif : ${w.zone}`
      : w.zone,
    signal_ids: split(w.signals),
    source_ids: w.source_ids,
    confidence: w.id.startsWith("VEG-") ? "review_required" : w.confiance,
    requires_verification: true,
    publication_eligible: false,
    reserve: w.reserve,
  }));
  const markers = master.reperes_fixes.filter(
    (r) =>
      r.date_mm_jj === mmdd &&
      (!production ||
        split(r.production).includes(production) ||
        r.production === "Toutes productions"),
  );
  const sourceIds = new Set([
    ...windows.flatMap((w) => w.source_ids),
    ...markers.flatMap((m) => m.source_ids),
  ]);
  const mobiles = master.evenements_mobiles.map((m) => ({
    name: m.nom,
    date: m.nom === "Pâques" ? easter(year) : null,
    status:
      m.nom === "Pâques" ? "computed_gregorian" : "annual_source_required",
    active: m.nom === "Pâques" && date === easter(year),
    question: m.enjeu,
    source_id: m.source_id,
    rule: m.regle,
    related_dates:
      m.nom === "Pâques"
        ? [
            { name: "Lundi de Pâques", offset: 1 },
            { name: "Ascension", offset: 39 },
            { name: "Pentecôte", offset: 49 },
            { name: "Lundi de Pentecôte", offset: 50 },
          ].map((f) => ({
            name: f.name,
            date: new Date(Date.parse(easter(year)) + f.offset * 86400000)
              .toISOString()
              .slice(0, 10),
          }))
        : [],
  }));
  return {
    version: ALMANAC_VERSION,
    sha256: receipt.sha256,
    date,
    time_zone: "Europe/Paris",
    region: profile ?? null,
    production: production ?? null,
    daily_question: day?.angle_editorial ?? null,
    leap_day: mmdd === "02-29",
    day_reference: day?.fenetre_id.startsWith("MARR-")
      ? markers.map((r) => r.id)
      : (day?.fenetre_id ?? null),
    windows,
    active_count: active.length,
    truncated: active.length > windows.length,
    markers,
    mobile_events: mobiles,
    sources: master.sources.filter((s) => sourceIds.has(s.id)),
    limitations: [
      master.meta.binding,
      "Région filtrée : périmètre de recherche, pas preuve de présence ou de stade.",
      ...(mmdd === "02-29"
        ? [
            "Fenêtres saisonnières actives uniquement ; aucun repère fixe hérité du 28 février.",
          ]
        : []),
    ],
  };
}
export type SeasonalContext = ReturnType<typeof getSeasonalEditorialContext>;
export function validateAlmanac(bytes?: Uint8Array) {
  if (
    bytes &&
    createHash("sha256").update(bytes).digest("hex") !== receipt.sha256
  )
    throw Error("ALMANAC_CHECKSUM");
  const unique = (values: string[]) => {
    if (new Set(values).size !== values.length)
      throw Error("ALMANAC_DUPLICATE");
  };
  const validMM = (v: string) => isCalendarDate(`2025-${v}`);
  unique(master.jours.map((d) => d.date_mm_jj));
  unique(master.fenetres.map((w) => w.id));
  unique(master.reperes_fixes.map((r) => r.id));
  unique(master.sources.map((s) => s.id));
  if (
    master.jours.length !== 365 ||
    master.fenetres.length !== 157 ||
    master.profils_regionaux.length !== 13
  )
    throw Error("ALMANAC_COUNTS");
  const sources = new Set(master.sources.map((s) => s.id)),
    windows = new Set(master.fenetres.map((w) => w.id)),
    contexts = new Set(
      master.contextes_mensuels_complementaires.map((c) => c.id),
    ),
    regulations = new Set(master.vigilances_reglementaires.map((r) => r.id));
  const markerIds = new Set(
    master.reperes_fixes.flatMap((r) => [
      r.id,
      ...("elements_patrimoniaux" in r
        ? (r.elements_patrimoniaux?.map((e) => e.id) ?? [])
        : []),
    ]),
  );
  const refs = (ids: string[]) => {
    if (ids.some((id) => !sources.has(id))) throw Error("ALMANAC_SOURCE_REF");
  };
  for (const w of master.fenetres) {
    if (!validMM(w.start) || !validMM(w.end)) throw Error("ALMANAC_INTERVAL");
    refs(w.source_ids);
  }
  for (const m of master.reperes_fixes) {
    if (!validMM(m.date_mm_jj)) throw Error("ALMANAC_MARKER_DATE");
    refs(m.source_ids);
  }
  for (const d of master.jours) {
    if (
      !validMM(d.date_mm_jj) ||
      !contexts.has(d.contexte_mensuel_id) ||
      d.fenetres_complementaires_ids.some((id) => !windows.has(id)) ||
      d.reperes_fixes_ids.some((id) => !markerIds.has(id)) ||
      d.vigilances_reglementaires_ids.some((id) => !regulations.has(id))
    )
      throw Error("ALMANAC_DAY_REF");
    if (
      !windows.has(d.fenetre_id) &&
      !(
        d.fenetre_id === `MARR-${d.date_mm_jj}` &&
        master.reperes_fixes.some((m) => m.date_mm_jj === d.date_mm_jj)
      )
    )
      throw Error("ALMANAC_ALIAS");
    refs(split(d.source_ids));
  }
  for (const m of master.evenements_mobiles) refs([m.source_id]);
  for (const c of master.contextes_mensuels_complementaires) refs(c.source_ids);
  for (const r of master.vigilances_reglementaires) refs(r.source_ids);
  for (const c of master.corrections_et_arbitrages) refs(c.appui_source_ids);
  return {
    days: master.jours.length,
    windows: master.fenetres.length,
    sources: sources.size,
    sha256: receipt.sha256,
    unresolved_signals: [
      ...new Set(master.fenetres.flatMap((w) => split(w.signals))),
    ]
      .filter((id) => !master.dictionnaire_signaux.some((s) => s.signal === id))
      .sort(),
  };
}
