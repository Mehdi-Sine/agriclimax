import type { ArchiveEntry } from "../../lib/server/weather-archives";
import { record } from "../../lib/server/weather-archive-codec";
import { isCalendarDate } from "../national/daily-availability";

export const FROZEN_SOURCE_VERSION = "editorial-source-pins-1";
export const EDITORIAL_HISTORY_DAYS = 60;
export const HISTORY_ADAPTER_VERSION = "nightly-era5-archive-1";
export type Era5Pin = {archive: ArchiveEntry; dates: string[]};
export type FrozenSourcePins = {era5: Era5Pin[]; weather: ArchiveEntry | null};

/** Original archives are retained and immutable. Pin qualified days, not the mutable catalogue. */
export function pinEra5Day(pins: Map<string, Era5Pin>, date: string, archive: ArchiveEntry) {
  const existing = pins.get(archive.sha256);
  if (existing) existing.dates.push(date);
  else pins.set(archive.sha256, {archive, dates:[date]});
}

function validPin(value: unknown, prefix: "era5" | "weather"): value is ArchiveEntry {
  return record(value) && typeof value.sha256 === "string" && /^[a-f0-9]{64}$/.test(value.sha256) &&
    value.path === `${prefix}/${value.sha256}.json.gz` &&
    typeof value.bytes === "number" && Number.isSafeInteger(value.bytes) && value.bytes > 0 && value.bytes <= 8 * 1024 ** 2 &&
    Array.isArray(value.dates) && value.dates.length <= 31 &&
    value.dates.every(d => typeof d === "string" && isCalendarDate(d));
}

export function frozenSourcePins(value: unknown, historyCutoff: string): FrozenSourcePins {
  if (!record(value) || !Array.isArray(value.era5) || value.era5.length > EDITORIAL_HISTORY_DAYS ||
      !(value.weather === null || validPin(value.weather, "weather"))) throw Error("MAP_SOURCE_PINS");
  const dates = new Set<string>();
  const archives = new Set<string>();
  const era5:Era5Pin[] = [];
  for (const pin of value.era5) {
    if (!record(pin) || !validPin(pin.archive, "era5") || !Array.isArray(pin.dates) ||
        pin.dates.length === 0 || pin.dates.length > pin.archive.dates.length ||
        archives.has(pin.archive.sha256)) throw Error("MAP_ERA5_PINS");
    const days:string[] = [];
    for (const day of pin.dates) {
      if (typeof day !== "string" || day > historyCutoff || !pin.archive.dates.includes(day) ||
          dates.has(day) || dates.size >= EDITORIAL_HISTORY_DAYS) throw Error("MAP_ERA5_DATES");
      dates.add(day);
      days.push(day);
    }
    era5.push({archive:pin.archive,dates:days});
    archives.add(pin.archive.sha256);
  }
  return {era5,weather:value.weather};
}
