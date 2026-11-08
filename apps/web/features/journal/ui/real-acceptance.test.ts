import { it, expect, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
import { nationalWatch } from "../../../lib/server/national-watch";
import { journal } from "../../../lib/server/journal";
import { nationalWeatherDocument } from "../../../lib/server/weather-archives";
import { journalMapData } from "./map-data";
import { selectKeyFigures } from "./key-figures";
// Opt-in, read-only real archive verification. No substitute data, no acquisition.
it.skipIf(process.env.TASK32B_REAL !== "1")(
  "audits map values, editorial figures and localized extremes against real archived inputs",
  async () => {
    const output = "../../docs/codex/task32/evidence/task32b";
    await mkdir(output, { recursive: true });
    const cycles = [];
    for (const requested of [
      "2026-11-07T00:00:00Z",
      "2026-11-06T00:00:00Z",
      "2026-11-06T06:00:00Z",
    ]) {
      const s = await nationalWatch(requested),
        e = await journal(requested),
        doc = await nationalWeatherDocument(requested);
      expect(doc).not.toBeNull();
      expect(Date.parse(s.run)).toBe(Date.parse(requested));
      const maps = ["frost", "heat", "rain", "dry", "thi"].map((p) =>
        journalMapData(s, p),
      );
      for (const map of maps) {
        expect(map.rows).toHaveLength(713);
        for (const r of map.rows) {
          const m = s.metrics.find(
            (m) => m.pra === r.id && m.phenomenon === map.phenomenon,
          )!;
          expect(r.value).toBe(m.detected === null ? null : m.value);
        }
      }
      const figures = selectKeyFigures(e, s);
      expect(figures.length).toBeGreaterThan(0);
      const extremes = e.key_facts.map((f) => {
        const event = [e.main_story, ...e.secondary_stories].find((story) =>
          story?.facts.includes(f.id),
        )!;
        const metric = s.metrics.filter(
          (m) =>
            event.pra_ids.includes(m.pra) &&
            m.phenomenon === event.phenomenon &&
            m.value === f.value,
        );
        expect(metric.length).toBeGreaterThan(0);
        const variable =
          event.phenomenon === "frost"
            ? "temperature_min"
            : event.phenomenon === "heat"
              ? "temperature_max"
              : event.phenomenon === "thi"
                ? "humidity"
                : "precipitation";
        return {
          phenomenon: event.phenomenon,
          region: event.region,
          value: f.value,
          unit: f.unit,
          period: f.period,
          provenance: f.provenance,
          quality_flags: f.quality_flags,
          decision:
            "Conservé dans les faits scientifiques ; remplacé en une par une étendue territoriale documentée, sans moyenne ni surface inférée.",
          altitude:
            "Non fournie par les données de ce contrat ; aucun contexte montagneux affirmé.",
          supports: metric.map((m) => {
            const p = s.places.find((p) => p.id === m.pra)!;
            const rows = doc!.selected_indices
              .map((i) => doc!.rows[i])
              .filter(
                (r) =>
                  r.pra_id === m.pra &&
                  r.variable === variable &&
                  r.valid_date >= s.period[0] &&
                  r.valid_date <= s.period[1],
              );
            expect(rows).toHaveLength(7);
            expect(
              rows.every(
                (r) =>
                  r.nature === "forecast" &&
                  r.spatial_coverage >= 0.9999 &&
                  r.temporal_coverage === 1,
              ),
            ).toBe(true);
            if (["frost", "heat", "rain"].includes(event.phenomenon))
              expect(rows.some((r) => r.value === f.value)).toBe(true);
            return {
              id: m.pra,
              name: p.name,
              region: p.region,
              rule_version: s.evidence[m.evidence_id].rule_version,
              rows: rows.map((r) => ({
                date: r.valid_date,
                value: r.value,
                unit: r.unit,
                source: r.source_id,
                model: r.model,
                run: r.model_run_at,
                nature: r.nature,
                spatial_coverage: r.spatial_coverage,
                temporal_coverage: r.temporal_coverage,
                quality_flags: r.quality_flags,
                provenance: r.provenance.checksum,
              })),
            };
          }),
        };
      });
      cycles.push({
        run: s.run,
        period: s.period,
        source: s.source_version,
        edition: e.edition_id,
        figures,
        extremes,
        maps: maps.map((m) => ({
          phenomenon: m.phenomenon,
          count: m.rows.length,
          available: m.rows.filter((r) => r.status === "available").length,
          partial: m.rows.filter((r) => r.status === "partial").length,
          sample: m.rows.slice(0, 3),
        })),
      });
    }
    expect(cycles[0].source).not.toBe(cycles[1].source);
    await writeFile(
      `${output}/real-audit.json`,
      JSON.stringify({ cycles }, null, 2),
    );
  },
  120000,
);
