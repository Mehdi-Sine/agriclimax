import "server-only";
import type {
  ArchivedDaily,
  NationalWeatherDocument,
} from "../../lib/server/weather-archives";
import {
  forecastWheatInputs,
  historicalWheatInputs,
} from "../../lib/server/wheat";
import { enrichHistoricalInputs } from "../../lib/server/climate-quality";
import type { InputProvider, ProductionDay } from "./engine";
import { RECIPES } from "./registry";

/** Read-only adapters; acquisition, selection, hashing and masks stay upstream. */
export async function historicalProvider(
  rows: ArchivedDaily[],
): Promise<InputProvider> {
  const inputs = new Map<string, Record<string, ProductionDay[]>>();
  for (const recipe of RECIPES) {
    const key = recipe.kernel.variables.join();
    if (inputs.has(key)) continue;
    if (recipe.kernel.variables.includes("humidity")) {
      // Operational ERA5 archive contains no RH. Never substitute a THI estimate.
      const thermal = RECIPES.find((r) => r.id === "temperature_mean")!;
      inputs.set(key, historicalWheatInputs(rows, thermal.kernel));
    } else
      inputs.set(
        key,
        await enrichHistoricalInputs(
          historicalWheatInputs(rows, recipe.kernel),
          recipe.kernel,
        ),
      );
  }
  return (pra, variables) => inputs.get(variables.join())?.[pra] ?? [];
}
export function forecastProvider(
  document: NationalWeatherDocument,
  dates: string[],
): InputProvider {
  const inputs = new Map<string, Record<string, ProductionDay[]>>();
  for (const recipe of RECIPES) {
    const key = recipe.kernel.variables.join();
    if (inputs.has(key)) continue;
    // Existing national archive has no qualified humidity pairs. Thermal data
    // remains usable; the THI result carries humidity_missing explicitly.
    const kernel = recipe.kernel.variables.includes("humidity")
      ? RECIPES.find((r) => r.id === "temperature_mean")!.kernel
      : recipe.kernel;
    inputs.set(key, forecastWheatInputs(document, kernel, dates));
  }
  return (pra, variables) => inputs.get(variables.join())?.[pra] ?? [];
}
