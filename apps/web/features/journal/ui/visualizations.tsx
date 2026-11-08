import type { RegionalSection } from "../model";
import { PHENOMENA } from "../../national-watch/model";
export const phenomenonLabel = (id: string) =>
  PHENOMENA.find((p) => p.id === id)?.label ?? id;
export function regionalRows(regions: RegionalSection[], phenomenon: string) {
  return regions.map((region) => ({
    region,
    coverage: region.coverage.find((c) => c.phenomenon === phenomenon),
  }));
}
export function proportion(affected: number, evaluated: number) {
  return evaluated > 0 ? Math.round((100 * affected) / evaluated) : null;
}
export function RegionalChart({
  regions,
  phenomenon,
}: {
  regions: RegionalSection[];
  phenomenon: string;
}) {
  const rows = regionalRows(regions, phenomenon).sort(
    (a, b) =>
      (proportion(b.coverage?.affected ?? 0, b.coverage?.evaluated ?? 0) ??
        -1) -
      (proportion(a.coverage?.affected ?? 0, a.coverage?.evaluated ?? 0) ?? -1),
  );
  return (
    <figure className={`regional-chart palette-${phenomenon}`}>
      <figcaption>
        <h3>Où le critère est-il franchi ?</h3>
        <p>
          {phenomenonLabel(phenomenon)} · PRA concernées / évaluables (nombre),
          puis proportion (%). Couverture : évaluables / total régional.
        </p>
      </figcaption>
      <ol>
        {rows.map(({ region, coverage: c }) => {
          const p = c ? proportion(c.affected, c.evaluated) : null;
          return (
            <li key={region.id}>
              <a href={region.href}>{region.label}</a>
              <span>
                {p === null
                  ? "Non évaluable"
                  : `${c!.affected} / ${c!.evaluated} · ${p} %`}
              </span>
              <div className="bar-track" aria-hidden="true">
                <div style={{ width: `${p ?? 0}%` }} />
              </div>
              <small>
                Couverture : {c?.evaluated ?? 0} / {region.total_pra} PRA
              </small>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
