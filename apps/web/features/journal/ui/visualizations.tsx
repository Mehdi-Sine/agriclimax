import type { RegionalSection } from "../model";
import paths from "./region-paths.json";
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
export function RegionalMap({
  regions,
  phenomenon,
}: {
  regions: RegionalSection[];
  phenomenon: string;
}) {
  const rows = regionalRows(regions, phenomenon);
  return (
    <figure className={`journal-map palette-${phenomenon}`}>
      <div className="figure-heading">
        <span>LA FRANCE EN PRÉVISION</span>
        <span>Part des PRA évaluables</span>
      </div>
      <svg
        viewBox="0 0 540 490"
        role="img"
        aria-labelledby="map-title map-description"
      >
        <title id="map-title">{`${phenomenonLabel(phenomenon)} : répartition régionale`}</title>
        <desc id="map-description">
          Proportion de petites régions agricoles franchissant le critère, et
          non part de surface agricole. Hachures : couverture incomplète. Les
          valeurs exactes sont disponibles dans le graphique régional.
        </desc>
        <defs>
          <pattern
            id="partial"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 7L7 0"
              stroke="var(--text-primary)"
              strokeWidth="1"
              opacity=".4"
            />
          </pattern>
        </defs>
        {paths.map((shape) => {
          const row = rows.find((r) => r.region.label === shape.name),
            c = row?.coverage,
            p = c ? proportion(c.affected, c.evaluated) : null;
          const fill =
            p === null
              ? "var(--national-unavailable)"
              : `var(--story-scale-${p === 0 ? 1 : p <= 25 ? 2 : p <= 50 ? 3 : p <= 75 ? 4 : 5})`;
          return (
            <g key={shape.name}>
              <title>{`${shape.name} : ${p === null ? "données absentes" : `${c!.affected} / ${c!.evaluated} PRA évaluables (${p} %), sur ${row!.region.total_pra} PRA`}`}</title>
              <path
                d={shape.path}
                fill={fill}
                stroke="var(--surface-raised)"
                strokeWidth="1.5"
                fillRule="evenodd"
              />
              {c && c.evaluated > 0 && c.evaluated < row!.region.total_pra && (
                <path
                  d={shape.path}
                  fill="url(#partial)"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <strong>{phenomenonLabel(phenomenon)}</strong>
        <div className="map-legend">
          {["0", "1–25", "26–50", "51–75", "76–100"].map((v, i) => (
            <span key={v}>
              <i style={{ background: `var(--story-scale-${i + 1})` }} />
              {v} %
            </span>
          ))}
        </div>
        <p>
          Gris : non évaluable · Hachures : couverture partielle. Les régions ne
          représentent pas une intensité moyenne.
        </p>
      </figcaption>
    </figure>
  );
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
