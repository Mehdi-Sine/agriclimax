"""Compact real-pilot summary and review map from existing contours; no DB or acquisition."""

from __future__ import annotations

import argparse
import html
import json
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

VARIABLES = ("temperature", "temperature_min", "temperature_max", "precipitation")


def state(row: dict[str, Any], index: int | None = None) -> str:
    counts = row["valid_counts"]
    if index is not None:
        return (
            "complete"
            if counts[index] == row["expected_cells"]
            and row[VARIABLES[index]] is not None
            else "partial"
            if counts[index] > 0
            else "unavailable"
        )
    if all(n == 0 for n in counts):
        return "unavailable"
    return "complete" if row["status"] == "available" else "partial"


def summary(outputs: list[dict[str, Any]]) -> dict[str, Any]:
    rows = [r for o in outputs for r in o["daily"]]
    ids = {o["identity"]["pra"] for o in outputs}
    if len(outputs) != 73 or len(ids) != 73 or len(rows) != 511:
        raise ValueError("Expected exactly 73 unique seven-day batches")
    seen = set()
    for row in rows:
        identity = (row["pra_id"], row["valid_date"])
        if identity in seen:
            raise ValueError("Duplicate PRA day")
        seen.add(identity)
        for i, var in enumerate(VARIABLES):
            if row["valid_counts"][i] < row["expected_cells"] and row[var] is not None:
                raise ValueError("Incomplete support published as a full-PRA value")
    details = []
    for output in sorted(outputs, key=lambda o: o["identity"]["pra"]):
        daily = output["daily"]
        details.append(
            {
                "pra": output["identity"]["pra"],
                "days": len(daily),
                "expected_cells": daily[0]["expected_cells"],
                "day_states": dict(Counter(state(r) for r in daily)),
                "variables": {
                    var: {
                        "states": dict(Counter(state(r, i) for r in daily)),
                        "minimum_weighted_coverage": min(
                            r["coverage"][i] for r in daily
                        ),
                        "maximum_weighted_coverage": max(
                            r["coverage"][i] for r in daily
                        ),
                    }
                    for i, var in enumerate(VARIABLES)
                },
            }
        )
    return {
        "scope": "73 selected PRA; not national coverage",
        "source": "era5-land",
        "real_cds": True,
        "interpolation": False,
        "renormalized_full_values": False,
        "pra": 73,
        "pra_days": 511,
        "states": dict(Counter(state(r) for r in rows)),
        "variables": {
            var: dict(Counter(state(r, i) for r in rows))
            for i, var in enumerate(VARIABLES)
        },
        "pra_details": details,
        "structural_support": "unknown; seven observed days do not establish permanent availability",
    }


def map_html(
    reference: dict[str, Any],
    sample: dict[str, Any],
    outputs: list[dict[str, Any]],
    day: str,
) -> str:
    selected = {r["id"]: r for r in sample["selection"]}
    rows = {
        r["pra_id"]: r for o in outputs for r in o["daily"] if r["valid_date"] == day
    }
    if set(rows) != set(selected):
        raise ValueError("Incomplete 73-PRA map")
    paths = []
    cards = []
    for feature in reference["features"]:
        code = feature["properties"]["code"]
        pid = "pra:" + code
        if pid not in selected:
            continue
        row = rows[pid]
        label = state(row)
        name = html.escape(feature["properties"]["name"])
        polygons = feature["geometry"]["coordinates"]
        if feature["geometry"]["type"] != "MultiPolygon":
            raise ValueError("Expected unchanged MultiPolygon reference")
        parts = []
        for polygon in polygons:
            for ring in polygon:
                parts.append("M" + " L".join(f"{x},{y}" for x, y in ring) + " Z")
        paths.append(
            f'<path class="{label}" d="{" ".join(parts)}"><title>{name} — {label}</title></path>'
        )
        values = " · ".join(
            "Indisponible" if row[v] is None else f"{row[v]:.2f}" for v in VARIABLES
        )
        coverage = " · ".join(
            f"{100 * c:.4f} % ({n}/{row['expected_cells']})"
            for c, n in zip(row["coverage"], row["valid_counts"], strict=True)
        )
        url = "/territories?" + urlencode(
            {
                "reference": sample["reference_version"],
                "dataset": "era5land-pilot73-20261012-20261018-v1",
                "date": day,
                "pra": pid,
            }
        )
        cards.append(
            f'<li data-pra="{pid}" data-state="{label}"><h2>{name} · {code}</h2><p>État : {label}</p><p>Tmean / Tmin / Tmax (°C), pluie (mm) : {values}</p><p>Couverture par variable : {coverage}</p><a href="{html.escape(url)}">Lecture PRA dans l’application</a></li>'
        )
    counts = dict(Counter(state(r) for r in rows.values()))
    return (
        """<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AgriclimaX — revue du pilote 73 PRA</title><style>
:root{--text:#152c24;--surface:#fff;--available:#176840;--partial:#9b5c00;--unavailable:#626a70}body{font:16px system-ui;color:var(--text);background:var(--surface);margin:auto;max-width:1100px;padding:1rem}svg{width:100%;height:auto;max-height:650px;background:#f5f7f5}path{stroke:#fff;stroke-width:.008;fill-rule:evenodd}.complete{fill:var(--available)}.partial{fill:var(--partial)}.unavailable{fill:var(--unavailable)}ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:1rem}li{border:1px solid #85958c;padding:.8rem;overflow-wrap:anywhere}h2{font-size:1rem}a{color:#155337}a:focus-visible{outline:3px solid #1157ae}p{line-height:1.5}</style>
<main><h1>Pilote réel · 73 PRA sur 713</h1><p>ERA5-Land · réanalyse · """
        + html.escape(day)
        + """ UTC. Période historique, pas du live. Cette carte de revue montre les seuls contours sélectionnés ; elle ne représente pas une couverture climatique nationale complète.</p><p>Données réellement calculées localement ; la validation de persistance DEV fait l’objet du rapport séparé. Les lacunes Marseille/Lyon et le millésime géométrique inconnu restent documentés.</p><p>Légende : vert = complete ; ocre = partial ; gris = unavailable. Un état partiel n’est jamais un zéro ou une absence de risque. """
        + html.escape(str(counts))
        + """</p><svg viewBox="0 0 1000 820" role="img" aria-label="Disponibilité observée des 73 PRA sélectionnées"><g transform="matrix(60 0 0 -72 360 3744)">"""
        + "".join(paths)
        + """</g></svg><p>Représentation des contours source inchangés, projection d’affichage uniquement. Tmean et pluie : moyennes spatiales ; Tmin/Tmax : extrêmes parmi les cellules. Une variable incomplète conserve NULL, sans interpolation ni substitution par station. Fraîcheur : période historique de réanalyse. Les indicateurs descriptifs ne sont pas un diagnostic agronomique validé.</p><ul>"""
        + "".join(cards)
        + """</ul></main></html>"""
    )


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=Path("work/task19b/real"))
    p.add_argument("--destination", choices=["local", "supabase"], default="local")
    p.add_argument("--output", type=Path, default=Path("work/task19b/review"))
    a = p.parse_args()
    sample = json.loads(Path("config/pilots/pra73-v1.json").read_text())
    reference = json.loads(
        Path(
            "config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json"
        ).read_text()
    )
    outputs = [json.loads(f.read_text()) for f in a.root.glob("batches/*/output.json")]
    outputs = [o for o in outputs if o["identity"]["destination"] == a.destination]
    result = summary(outputs)
    a.output.mkdir(parents=True, exist_ok=True)
    (a.output / "summary.json").write_text(json.dumps(result, indent=2) + "\n")
    (a.output / "map.html").write_text(
        map_html(reference, sample, outputs, "2026-10-18")
    )
    print(json.dumps({k: v for k, v in result.items() if k != "pra_details"}))


if __name__ == "__main__":
    main()
