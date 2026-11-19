#!/usr/bin/env python3
"""Contrôles autonomes de la surcouche éditoriale AgriClimaX 366 jours.

Exécution depuis la racine du dépôt :
    python scripts/validate_almanach_rotation.py
"""
from __future__ import annotations

import calendar
import collections
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT / "config/almanach/agriclimax-almanach.v1.json"
V2 = ROOT / "config/almanach/agriclimax-editorial-rotation.v2.json"


def main() -> None:
    source = json.loads(V1.read_text(encoding="utf-8"))
    rotation = json.loads(V2.read_text(encoding="utf-8"))
    old = {day["date_mm_jj"]: day for day in source["jours"]}
    days = rotation["jours"]
    by_date = {day["date_mm_jj"]: day for day in days}
    categories = {c["code"]: c for c in rotation["categories"]}
    regions = {r["region"] for r in source["profils_regionaux"]}

    assert len(source["jours"]) == 365
    assert len(days) == len(by_date) == 366, "366 dates uniques obligatoires"
    assert len(categories) == 15, "15 catégories, sans doublon"
    assert set(by_date) == set(old) | {"02-29"}, "les 365 dates d'origine sont préservées"
    assert len(regions) == 13

    for year, expected in [(2027, 365), (2028, 366), (2100, 365), (2400, 366)]:
        active = [day for day in days if day["date_mm_jj"] != "02-29" or calendar.isleap(year)]
        dates = [dt.date(year, d["calendrier"]["mois"], d["calendrier"]["jour_du_mois"]) for d in active]
        assert len(dates) == len(set(dates)) == expected
        assert dates == sorted(dates), "ordre du calendrier instable"

    categories_count = collections.Counter()
    region_count = collections.Counter()
    last_focus = {}
    by_month_family = collections.defaultdict(set)
    for ix, day in enumerate(days):
        key = day["date_mm_jj"]
        focus = day["focus_principal"]
        category = focus["categorie"]
        assert category in categories
        assert focus["famille"] == categories[category]["famille"]
        assert focus["theme"].strip() and focus["question_editoriale"].strip()
        assert day["region_du_jour"]["region"] in regions
        assert day["validation"]["statut"] == "orientation_theorique_non_constatee"
        if key == "02-29":
            assert day["calendrier"]["activation"] == "annee_bissextile_uniquement"
            assert day["lien_source_v1"] is None
        else:
            assert day["calendrier"]["activation"] == "toutes_annees"
            assert day["lien_source_v1"]["date_mm_jj"] == key
            assert day["lien_source_v1"]["fenetre_id"] == old[key]["fenetre_id"]
        if category.startswith("F"):
            assert focus["espece_ou_production"], f"{key}: espèce ou production absente"
        else:
            assert focus["espece_ou_production"] is None
        focus_id = (category, focus["theme"])
        if focus_id in last_focus:
            assert ix - last_focus[focus_id] >= 30, f"répétition trop proche : {focus_id}"
        last_focus[focus_id] = ix
        categories_count[category] += 1
        region_count[day["region_du_jour"]["region"]] += 1
        by_month_family[day["calendrier"]["mois"]].add(focus["famille"])

    assert set(categories_count) == set(categories)
    assert set(region_count) == regions
    assert max(region_count.values()) - min(region_count.values()) <= 1
    assert all(len(by_month_family[month]) >= 2 for month in range(1, 13))
    print("OK - 366 dates uniques, 365 non bissextiles, 13 régions équilibrées, 15 catégories.")
    print("Focus par catégorie :", dict(sorted(categories_count.items())))
    print("Régions (minimum / maximum) :", min(region_count.values()), max(region_count.values()))


if __name__ == "__main__":
    main()
