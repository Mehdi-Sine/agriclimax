"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supportPolicy } from "./observed-support";
import { RULES, type Production } from "./catalogue";
import type { AgroResult } from "./calculate";
import type { AgroPayload } from "../../lib/server/agroclimatic";
import type { NationalAvailability } from "../national/daily-availability";
import { calendarDays, trailingStart } from "../national/daily-availability";
import type { PraCollection } from "../national/map";
import type { WeatherCycle } from "../operational/model";
import { useResource } from "../unified/resource";
import { CattleContext } from "../agriculture/cattle-context";
import { WheatContext } from "../agriculture/wheat-context";
import { INDICATORS, type TerritorialValue } from "../unified/model";
const fmt = (v: number | null | undefined) =>
  v == null
    ? "Indisponible"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);
export function useAgroclimatic(
  active: boolean,
  collection: PraCollection | null,
  availability: NationalAvailability | null,
) {
  const search = useSearchParams(),
    pathname = usePathname();
  const production: Production =
    search.get("production") === "cattle" ? "cattle" : "wheat";
  const rule =
    RULES.find(
      (r) => r.id === search.get("agro") && r.production === production,
    ) ?? RULES.find((r) => r.production === production)!;
  const mode =
    search.get("temporal") === "forecast"
      ? "forecast"
      : search.get("temporal") === "recent"
        ? "recent"
        : "history";
  const catalogue = useResource<WeatherCycle>(
    active
      ? "/api/operational?experimental=weather&catalogue=1" +
          (search.get("weather_run")
            ? "&run=" + encodeURIComponent(search.get("weather_run")!)
            : "")
      : null,
  );
  const root = catalogue.data?.run?.slice(0, 10) ?? "";
  const forecastStart = root ? trailingStart(root, 0) : "";
  const defaultEnd =
    mode === "history"
      ? (availability?.latest ?? "")
      : mode === "recent"
        ? root
        : forecastStart;
  const start =
    search.get("agro_start") ??
    (mode === "history" && defaultEnd
      ? trailingStart(defaultEnd, 7)
      : mode === "recent"
        ? root
        : forecastStart);
  const end = search.get("agro_end") ?? defaultEnd;
  const threshold =
    rule.threshold === null
      ? null
      : Number(search.get("agro_threshold") ?? rule.threshold);
  const pra = search.get("pra") ?? "";
  const query = new URLSearchParams({
    indicator: rule.id,
    temporal: mode,
    start,
    end,
    ...(pra ? { pra } : {}),
    ...(threshold !== null ? { threshold: String(threshold) } : {}),
    ...(search.get("weather_run") ? { run: search.get("weather_run")! } : {}),
  });
  const resource = useResource<AgroPayload>(
    active && calendarDays(start, end).length
      ? `/api/agroclimatic?${query}`
      : null,
  );
  const supportResource = useResource<{
    collection: PraCollection;
    available_dates?: string[];
  }>(
    active && mode === "history" && supportPolicy(rule)
      ? "/api/national/support?" +
          new URLSearchParams({ start, end, variable: rule.variables[0] })
      : null,
  );
  const validSupportKey =
    resource.data?.data
      .filter((r) => r.observed_value != null && r.support_id)
      .map((r) => r.support_id)
      .sort()
      .join(",") ?? "";
  const coveredSupport = useMemo(() => {
    const ids = new Set(validSupportKey.split(","));
    const source = supportResource.data?.collection;
    return source
      ? {
          ...source,
          features: source.features.filter(
            (f) => f.properties.support_id && ids.has(f.properties.support_id),
          ),
        }
      : null;
  }, [supportResource.data, validSupportKey]);
  const data = resource.data?.data ?? [],
    current = data.find((r) => r.territoryId === pra),
    feature = collection?.features.find((f) => f.id === pra);
  const [colors, setColors] = useState<string[]>([]),
    [queryPra, setQueryPra] = useState("");
  const tokens =
    rule.unit === "mm"
      ? [
          "--map-rain-1",
          "--map-rain-2",
          "--map-rain-3",
          "--map-rain-4",
          "--map-rain-5",
        ]
      : [
          "--map-cool",
          "--map-cool-light",
          "--map-mid",
          "--map-warm-light",
          "--map-warm",
        ];
  const colorKey = tokens.join(",");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const css = getComputedStyle(document.documentElement);
      setColors(colorKey.split(",").map((t) => css.getPropertyValue(t).trim()));
    });
    return () => cancelAnimationFrame(frame);
  }, [colorKey]);
  function change(patch: Record<string, string>) {
    const p = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    window.history.pushState(null, "", `${pathname}?${p}`);
  }
  const values = data.flatMap((r) =>
      (r.value ?? r.observed_value) == null
        ? []
        : [(r.value ?? r.observed_value)!],
    ),
    low = values.length ? Math.min(...values) : 0,
    high = values.length ? Math.max(...values) : 1;
  const bounds = Array.from(
    { length: 5 },
    (_, i) => low + ((high - low || 1) * (i + 1)) / 5,
  );
  const families = [
    ...new Set(
      RULES.filter((r) => r.production === production).map((r) => r.family),
    ),
  ];
  const matches = (collection?.features ?? []).filter((f) =>
    `${f.properties.name} ${f.properties.code} ${f.properties.department_name}`
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .includes(
        queryPra
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase(),
      ),
  );
  const eligible = data.filter((r) => r.value !== null),
    conditions = eligible.filter(
      (r) =>
        r.parameters.threshold !== null &&
        r.value! > 0 &&
        rule.operator !== "gdd" &&
        rule.operator !== "thi",
    );
  const historicalClimate = current
    ? ({
        ...current,
        provenance: current.provenance.join(" · "),
        dataScale: "pra",
        datasetVersion: resource.data?.source_version ?? "",
        freshness: current.data_freshness.join(","),
      } satisfies TerritorialValue)
    : undefined;
  const wheatDef = INDICATORS.find((i) => i.id === rule.id) ?? {
    ...INDICATORS[0],
    label: rule.label,
    unit: rule.unit,
  };
  const filters = (
    <>
      <section
        className="unified-filters filters-open"
        aria-label="Filtres agroclimatiques"
      >
        <label>
          Production
          <select
            aria-label="Production"
            value={production}
            onChange={(e) =>
              change({
                production: e.target.value,
                agro: e.target.value === "cattle" ? "thi" : "gdd",
                agro_threshold: "",
              })
            }
          >
            <option value="wheat">Blé tendre</option>
            <option value="cattle">Bovins</option>
          </select>
        </label>
        <label>
          Famille
          <select
            aria-label="Famille"
            value={rule.family}
            onChange={(e) =>
              change({
                agro: RULES.find(
                  (r) =>
                    r.production === production && r.family === e.target.value,
                )!.id,
                agro_threshold: "",
              })
            }
          >
            {families.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Indicateur
          <select
            aria-label="Indicateur"
            value={rule.id}
            onChange={(e) =>
              change({ agro: e.target.value, agro_threshold: "" })
            }
          >
            {RULES.filter((r) => r.production === production).map((r) => (
              <option value={r.id} key={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Temporalité
          <select
            aria-label="Temporalité"
            value={mode}
            onChange={(e) =>
              change({ temporal: e.target.value, agro_start: "", agro_end: "" })
            }
          >
            <option value="history">Historique · réanalyse</option>
            <option value="recent">Récent · estimation par prévision</option>
            <option value="forecast">Prévisions</option>
          </select>
        </label>
        <label>
          Début · UTC
          <input
            type="date"
            value={start}
            onChange={(e) => change({ agro_start: e.target.value })}
          />
        </label>
        <label>
          Fin · UTC
          <input
            type="date"
            value={end}
            onChange={(e) => change({ agro_end: e.target.value })}
          />
        </label>
        {threshold !== null && (
          <label>
            {rule.operator === "gdd" ? "Base" : "Seuil"} ·{" "}
            {rule.variables.includes("humidity")
              ? "THI"
              : rule.variables[0] === "precipitation"
                ? "mm"
                : "°C"}
            <input
              type="number"
              min={rule.variables[0] === "precipitation" ? 0 : -30}
              max="100"
              step="0.5"
              value={threshold}
              onChange={(e) => change({ agro_threshold: e.target.value })}
            />
          </label>
        )}
        <label>
          Rechercher une PRA
          <input
            type="search"
            value={queryPra}
            onChange={(e) => setQueryPra(e.target.value)}
            placeholder="Nom, code, département"
          />
        </label>
        <label>
          PRA
          <select
            aria-label="PRA"
            value={pra}
            onChange={(e) => change({ pra: e.target.value })}
          >
            <option value="">Choisir un territoire</option>
            {(feature && !matches.includes(feature)
              ? [feature, ...matches]
              : matches
            ).map((f) => (
              <option key={f.properties.code} value={String(f.id)}>
                {f.properties.name} · {f.properties.code}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="unified-context">
        {mode === "forecast"
          ? [3, 7]
              .map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    change({
                      agro_start: root ? trailingStart(root, 1 - n) : "",
                      agro_end: root ? trailingStart(root, 1 - n) : "",
                    })
                  }
                >
                  J+{n}
                </button>
              ))
              .concat([
                <button
                  key="week"
                  onClick={() =>
                    change({
                      agro_start: forecastStart,
                      agro_end: root ? trailingStart(root, -6) : "",
                    })
                  }
                >
                  Prochaine semaine · séries
                </button>,
              ])
          : mode === "history"
            ? [7, 30].map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    change({
                      agro_start: availability?.latest
                        ? trailingStart(availability.latest, n)
                        : "",
                      agro_end: availability?.latest ?? "",
                    })
                  }
                >
                  {n} jours
                </button>
              ))
            : null}
        <span>
          {mode === "history"
            ? "ERA5-Land · réanalyse"
            : `Cycle ${catalogue.data?.run ?? "vérification…"} · ${mode === "recent" ? "estimation issue de prévisions, pas une observation" : "prévisions, pas des observations"}`}{" "}
          · fenêtre explicite, 30 jours maximum
        </span>
      </div>
      {mode === "history" &&
        supportResource.data?.available_dates &&
        supportResource.data.available_dates.length > 0 &&
        supportResource.data.available_dates.length <
          calendarDays(start, end).length && (
          <p role="status">
            Les supports partiels sont documentés sur{" "}
            {supportResource.data.available_dates.length}/
            {calendarDays(start, end).length} journées de cette fenêtre ; leurs
            cumuls restent indisponibles sur la période entière.{" "}
            {calendarDays(
              supportResource.data.available_dates[0],
              supportResource.data.available_dates.at(-1)!,
            ).length === supportResource.data.available_dates.length && (
              <button
                onClick={() =>
                  change({
                    agro_start: supportResource.data!.available_dates![0],
                    agro_end: supportResource.data!.available_dates!.at(-1)!,
                  })
                }
              >
                Consulter les supports disponibles :{" "}
                {supportResource.data.available_dates[0]} →{" "}
                {supportResource.data.available_dates.at(-1)}
              </button>
            )}
          </p>
        )}
      <p>
        Indicateurs exploratoires à l’échelle PRA. Aucun stade phénologique,
        dommage, diagnostic animal ou conseil automatique.
      </p>
    </>
  );
  const panel = feature ? (
    <>
      <span className="eyebrow">PRA · {feature.properties.code}</span>
      <h2>{feature.properties.name}</h2>
      <p>
        {production === "wheat" ? "Blé tendre" : "Bovins"} · {rule.label}
      </p>
      <div className="unified-value">
        <strong>
          {fmt(current?.value ?? current?.observed_value)}{" "}
          <em>
            {(current?.value ?? current?.observed_value) != null
              ? rule.unit
              : ""}
          </em>
        </strong>
      </div>
      <p>
        {start} → {end} UTC ·{" "}
        {mode === "forecast"
          ? "Prévisions"
          : mode === "recent"
            ? "Estimation récente"
            : "Réanalyse historique"}
      </p>
      <p>
        {current
          ? `${current.observedDays}/${current.expectedDays} journées exploitables · ${current.observedDays === current.expectedDays ? "Toutes les journées renseignées" : "Période incomplète"} · ${current.reason ?? "variables compatibles"}`
          : "Sélection conservée ; données en cours de lecture ou indisponibles."}
      </p>
      {current?.support_scope && current.support_scope !== "whole_pra" && (
        <p className="coastal-qualification">
          {current.support_scope === "qualified_pra_estimate"
            ? "Estimation qualifiée à couverture ≥90% ; moyenne calculée sur la portion renseignée."
            : current.observed_value != null
              ? "Valeur de la portion renseignée uniquement ; aucune valeur pour la PRA entière."
              : "Cumul indisponible sur un support commun prouvé."}{" "}
          Couverture spatiale : {fmt((current.spatial_coverage ?? 0) * 100)} % ·
          couverture temporelle : {fmt((current.temporal_coverage ?? 0) * 100)}{" "}
          %. La surface colorée représente seulement le support commun
          réellement renseigné.
        </p>
      )}
      {mode === "history" &&
        current?.observed_value != null &&
        ["temperature_min", "temperature_max"].includes(rule.variables[0]) && (
          <p>
            Événement de l’extrême natif sur les seules cellules couvertes. Les
            cellules absentes peuvent modifier l’extrême et le nombre de jours
            de la PRA entière ; un zéro sur ce support ne prouve pas une absence
            de chaleur ou de gel sur toute la PRA.
          </p>
        )}
      {mode === "history" && stateCrozon(current) && (
        <p>
          Absence de support ERA5-Land : aucun historique inventé.{" "}
          <button
            onClick={() =>
              change({ temporal: "forecast", agro_start: "", agro_end: "" })
            }
          >
            Consulter la météo opérationnelle disponible
          </button>
        </p>
      )}
      {current?.reason && (
        <p role="status">
          {current.reason === "incompatible_spatial_support"
            ? "Cumul refusé : supports spatiaux différents. Aucune union des surfaces journalières n’est affichée."
            : current.reason === "qualified_spatial_estimate" ||
                current.reason === "observed_area_only"
              ? "Résultat exploratoire sur support spatial explicite, sans extrapolation de la portion non renseignée."
              : current.reason === "incompatible_sources_or_runs"
                ? "Cumul refusé : changement de source ou de run. Consultez les journées ci-dessous ou réduisez la période."
                : rule.variables.includes("humidity")
                  ? "THI indisponible sans température et humidité conjointes valides. La chaleur météorologique reste accessible dans la liste des indicateurs."
                  : "Aucun cumul complet affiché lorsque des journées ou des variables manquent."}
        </p>
      )}
      {mode === "history" &&
        current?.value === null &&
        current?.observed_value == null &&
        ["temperature_min", "temperature_max"].includes(rule.variables[0]) && (
          <p>
            Les supports disponibles ne fournissent pas d’extrême natif vérifié
            pour ce territoire. Une température moyenne ne permet pas de
            reconstituer les journées chaudes ou de gel ; ces résultats restent
            indisponibles.
          </p>
        )}
      {current && (
        <>
          <h3>
            Évolution{" "}
            {mode === "forecast"
              ? "prévue"
              : mode === "recent"
                ? "estimée"
                : "historique"}
          </h3>
          <Series
            result={current}
            cumulative={rule.operator === "gdd"}
            rain={rule.unit === "mm" || rule.variables[0] === "precipitation"}
            threshold={
              ["gdd", "sum", "thi"].includes(rule.operator) ? null : threshold
            }
            unit={
              rule.unit === "jours"
                ? rule.variables.includes("humidity")
                  ? "THI"
                  : rule.variables[0] === "precipitation"
                    ? "mm"
                    : "°C"
                : rule.unit
            }
          />
          <p>
            {["gdd", "thi", "sum"].includes(rule.operator)
              ? ""
              : `Épisodes : ${fmt(current.episodes)} · durée maximale : ${fmt(current.longest)} jours. Seuil : ${fmt(threshold)}.`}{" "}
            Les lacunes interrompent les courbes.
          </p>
        </>
      )}
      {current && current.signals.length > 0 && (
        <details>
          <summary>
            Conditions climatiques à surveiller · {current.signals.length}{" "}
            journées
          </summary>
          <p>
            Signaux descriptifs exploratoires ; aucune alerte officielle ni
            inférence de dommages.
          </p>
          <ul>
            {current.signals.map((s) => (
              <li key={s.date}>
                {s.date} UTC · {s.territory} · {s.variable} : {fmt(s.value)}{" "}
                {s.comparison} {fmt(s.threshold)} · {s.source} · run{" "}
                {s.run ?? "réanalyse"}
              </li>
            ))}
          </ul>
          <p>{rule.limits}</p>
        </details>
      )}
      {mode !== "forecast" && root && (
        <button
          onClick={() =>
            change({ temporal: "forecast", agro_start: "", agro_end: "" })
          }
        >
          Consulter les prévisions · J+1 à J+7
        </button>
      )}
      {production === "wheat" ? (
        <WheatContext
          pra={pra}
          climate={historicalClimate}
          indicator={wheatDef}
          start={start}
          end={end}
          threshold={threshold ?? 0}
        />
      ) : (
        <CattleContext department={feature.properties.department} pra={pra} />
      )}
      {current && (
        <details>
          <summary>Provenance et qualité</summary>
          <p>
            Règle {current.rule_version} · calcul {resource.data?.calculated_at}{" "}
            · statut exploratoire
          </p>
          <p>{current.quality_flags.join(" · ")}</p>
          <p>{current.data_freshness.join(" · ")}</p>
          <ul>
            {current.provenance.map((p) => (
              <li key={p} style={{ overflowWrap: "anywhere" }}>
                {p}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details open>
        <summary>Explication scientifique et limites</summary>
        <p>{rule.description}</p>
        <p>{rule.formula}</p>
        <p>{rule.limits}</p>
        <a href={rule.source.split(" — ")[0]}>Référence scientifique</a>
      </details>
    </>
  ) : (
    <>
      <h2>Explorer un territoire</h2>
      <p>
        Choisissez une production, un indicateur et une PRA. Toutes les PRA
        restent sélectionnables lorsque l’indicateur est indisponible.
      </p>
    </>
  );
  const summary = (
    <section
      className="unified-method"
      aria-label="Synthèse nationale agroclimatique"
      id="sources"
    >
      <h2>Synthèse nationale · {rule.label}</h2>
      <p>
        {eligible.length}/713 PRA exploitables ·{" "}
        {data.filter((r) => r.status === "partial").length} périodes partielles
        · {data.filter((r) => r.status === "unavailable").length} indisponibles.{" "}
        {start} → {end} UTC.
      </p>
      <div className="agro-class-distribution">
        {bounds.map((b, i) => (
          <span key={i} style={{ borderTopColor: `var(${tokens[i]})` }}>
            <span>
              {fmt(i === 0 ? low : bounds[i - 1])} – {fmt(b)} :{" "}
              {
                eligible.filter(
                  (r) =>
                    r.value! >= (i === 0 ? low : bounds[i - 1]) &&
                    (i === 0
                      ? r.value! <= b
                      : r.value! > bounds[i - 1] && r.value! <= b),
                ).length
              }{" "}
              PRA
            </span>
          </span>
        ))}
      </div>
      <p>
        {rule.operator === "gdd" || rule.operator === "thi"
          ? "Aucun signal de dépassement défini pour cette vue. "
          : ""}
        {conditions.length} PRA avec conditions climatiques à surveiller selon
        le seuil configuré. Aucun risque de dommage estimé.
      </p>
      <details>
        <summary>Parcourir les territoires concernés</summary>
        {conditions.map((r) => (
          <button
            key={r.territoryId}
            onClick={() => change({ pra: r.territoryId })}
          >
            {collection?.features.find((f) => f.id === r.territoryId)
              ?.properties.name ?? r.territoryId}{" "}
            · {fmt(r.value)} {rule.unit}
          </button>
        ))}
      </details>
    </section>
  );
  return {
    filters,
    coveredSupport,
    panel,
    summary,
    mapTitle: (
      <div className="unified-map-title">
        <strong>
          {production === "wheat" ? "Blé tendre" : "Bovins"} · {rule.label} ·{" "}
          {rule.unit}
        </strong>
        <span>
          {start} → {end} UTC ·{" "}
          {mode === "forecast"
            ? "Prévisions"
            : mode === "recent"
              ? "Estimation"
              : "Réanalyse"}
        </span>
      </div>
    ),
    mapState: (
      <p role={resource.error ? "alert" : "status"}>
        {resource.error
          ? `${resource.error} Vérifiez les dates (J+1 à J+7 pour la prévision) et la couverture.`
          : !resource.data
            ? "Chargement des indicateurs nationaux…"
            : `${eligible.length}/713 valeurs PRA (dont estimations qualifiées) · ${data.filter((r) => r.observed_value != null && r.value === null).length} valeurs de portion seulement. Gris : portion absente ou résultat non calculable, jamais zéro.`}
      </p>
    ),
    legend: (
      <div className="unified-legend">
        <div className="legend-ramp">
          {bounds.map((b, i) => (
            <span key={i} style={{ background: `var(${tokens[i]})` }}>
              <small>≤ {fmt(b)}</small>
            </span>
          ))}
        </div>
        <p>
          {rule.unit} · limites PRA uniformes ; surfaces colorées partielles :
          portions réellement renseignées sur toute la période ; reste grisé.
          Une estimation ≥90% ne constitue pas une mesure intégrale.
        </p>
      </div>
    ),
    mapProps: {
      selected: pra,
      onSelect: (id: string) => change({ pra: id }),
      quantitative: {
        values: data.map((r) => ({
          ...r,
          value:
            r.support_id &&
            !coveredSupport?.features.some(
              (f) => f.properties.support_id === r.support_id,
            )
              ? null
              : (r.value ?? r.observed_value ?? null),
        })),
        field: "value" as const,
        unit: rule.unit,
        bounds,
        colors: colors.length
          ? colors
          : [
              "transparent",
              "transparent",
              "transparent",
              "transparent",
              "transparent",
            ],
      },
    },
  };
}
function stateCrozon(current: AgroResult | undefined) {
  return current?.territoryId === "pra:29102" && current.observedDays === 0;
}
function Series({
  result,
  cumulative,
  rain,
  unit,
  threshold,
}: {
  result: AgroResult;
  cumulative: boolean;
  rain: boolean;
  unit: string;
  threshold: number | null;
}) {
  const rows = result.series.map((r, i) => {
    const prefix = result.series.slice(0, i + 1);
    return {
      ...r,
      value: cumulative
        ? prefix.some(
            (p) => p.value === null || p.support_id !== prefix[0].support_id,
          )
          ? null
          : prefix.reduce((sum, p) => sum + p.value!, 0)
        : r.value,
    };
  });
  const nums = rows.flatMap((r) => (r.value === null ? [] : [r.value])),
    min = Math.min(0, threshold ?? 0, ...nums),
    max = Math.max(1, threshold ?? 0, ...nums),
    span = max - min || 1;
  const path = rows
    .map((r, i) =>
      r.value === null
        ? ""
        : `${i > 0 && rows[i - 1].value !== null && rows[i - 1].support_id === r.support_id ? "L" : "M"} ${30 + (i * 280) / Math.max(1, rows.length - 1)} ${120 - ((r.value - min) * 100) / span}`,
    )
    .join(" ");
  return (
    <>
      {cumulative && (
        <>
          <h4>Température moyenne source · °C</h4>
          <Series
            result={{
              ...result,
              series: result.series.map((r) => ({
                ...r,
                value: r.temperature,
              })),
            }}
            cumulative={false}
            rain={false}
            unit="°C"
            threshold={result.parameters.threshold}
          />
          <h4>Trajectoire des degrés-jours cumulés</h4>
        </>
      )}
      <figure className="unified-chart">
        <svg
          viewBox="0 0 340 150"
          role="img"
          aria-label={`Évolution quotidienne ${unit}, jours absents interrompus`}
        >
          <text x="0" y="15">
            {fmt(max)}
          </text>
          {threshold !== null && (
            <line
              x1="25"
              x2="325"
              y1={120 - ((threshold - min) * 100) / span}
              y2={120 - ((threshold - min) * 100) / span}
              stroke="var(--text-primary)"
              strokeDasharray="4 4"
            />
          )}
          {rain ? (
            rows.map((r, i) =>
              r.value === null ? null : (
                <rect
                  className="observed-line"
                  key={r.date}
                  x={30 + (i * 280) / Math.max(1, rows.length)}
                  y={120 - ((r.value - min) * 100) / span}
                  width={Math.max(2, 250 / rows.length)}
                  height={((r.value - min) * 100) / span}
                  fill="var(--map-rain-4)"
                />
              ),
            )
          ) : (
            <g>
              <path className="observed-line" d={path} />
              {rows.map((r, i) =>
                r.value === null ? null : (
                  <circle
                    key={r.date}
                    cx={30 + (i * 280) / Math.max(1, rows.length - 1)}
                    cy={120 - ((r.value - min) * 100) / span}
                    r="2.5"
                    fill="var(--map-rain-4)"
                  />
                ),
              )}
            </g>
          )}
        </svg>
        <figcaption>
          {cumulative
            ? "Cumul GDD arrêté à la première lacune"
            : rain
              ? "Précipitations quotidiennes"
              : "Valeurs quotidiennes avant compte ou séquence"}{" "}
          · {unit}
        </figcaption>
      </figure>
      <details>
        <summary>Journées, seuils et sources</summary>
        <div className="history-table">
          <table>
            <thead>
              <tr>
                <th>Date UTC</th>
                <th>Valeur</th>
                <th>Nature</th>
                <th>Source / run</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <th>{r.date}</th>
                  <td>{fmt(r.value)}</td>
                  <td>{r.nature ?? "Absente"}</td>
                  <td>
                    {r.source} {r.run}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
