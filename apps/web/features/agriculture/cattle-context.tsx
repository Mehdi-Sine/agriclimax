"use client";
import Link from "next/link";
import { useAgriculturalData } from "./explorer";
import {
  agriculturalValue,
  type AgriculturalDataset,
  type AgriculturalManifest,
} from "./model";

type Dataset = AgriculturalDataset & {
  source: AgriculturalManifest;
  rule_version: string;
  data_freshness: string;
  provenance: string;
};
const INDICATOR = "saa-efa-20-eff-departement";
export function CattleContext({
  department,
  pra,
}: {
  department: string | undefined;
  pra: string;
}) {
  const resource = useAgriculturalData<Dataset>(
    department
      ? `/api/agriculture?action=dataset&indicator=${INDICATOR}`
      : null,
  );
  const dataset = resource.data,
    year = 2025;
  const row = dataset?.rows.find((r) => r.code === department);
  const current = agriculturalValue(row, dataset?.indicator.years ?? [], year);
  const readable =
    current.value === null
      ? "Indisponible"
      : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
          current.value,
        );
  const query = new URLSearchParams({
    pra,
    agri_production: "saa-efa-20",
    agri_variable: "EFF",
    echelle: "departement",
    annee: String(year),
    ...(department ? { territoire: "dep:" + department } : {}),
  });
  return (
    <section aria-label="Contexte bovin départemental">
      <h3>Contexte agricole · département</h3>
      <p>
        La couverture climatique de la PRA ne prouve pas la présence d’animaux.
        Les prairies RPG ne sont pas des effectifs bovins.
      </p>
      {!department ? (
        <p>
          Rattachement départemental absent du référentiel : aucun effectif
          attribué.
        </p>
      ) : resource.error ? (
        <p role="status">
          Contexte SAA départemental inaccessible ; le THI reste consultable.
        </p>
      ) : !dataset ? (
        <p role="status">Chargement des effectifs départementaux SAA…</p>
      ) : (
        <>
          <p>
            <strong>
              {readable}
              {current.value !== null ? " têtes" : ""}
            </strong>{" "}
            · ensemble de l’espèce bovine · département{" "}
            {row?.name ?? department} ({department}) · {year}.
          </p>
          <p>
            {current.status === "suppressed"
              ? "Secret statistique : aucune valeur reconstituée."
              : current.value === null
                ? "Effectif indisponible ; aucun zéro déduit."
                : dataset.source.statistical_status[String(year)] ===
                    "provisional"
                  ? "Donnée SAA provisoire."
                  : "Statut : " + current.status}
            . Ce nombre concerne tout le département ; aucune répartition entre
            PRA, aucun nombre d’animaux exposés n’est calculé.
          </p>
          <details>
            <summary>Source agricole et limites d’échelle</summary>
            <p>
              Agreste / SSP · {dataset.indicator.label} · unité{" "}
              {dataset.indicator.unit} · échelle officielle{" "}
              {dataset.indicator.scale}.
            </p>
            <p>
              Règle {dataset.rule_version} · publication{" "}
              {dataset.data_freshness} · acquisition{" "}
              {dataset.source.acquired_at}.
            </p>
            <a href={dataset.provenance}>Source officielle SAA</a>
          </details>
        </>
      )}
      <Link href={"/productions?" + query}>
        Explorer les effectifs à l’échelle départementale
      </Link>
    </section>
  );
}
