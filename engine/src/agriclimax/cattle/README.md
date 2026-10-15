# Cattle heat exposure — Task 14

`thi.evaluate` : référence Python pure, grille horaire ou quotidienne explicite,
UTC semi-ouvert, aucune imputation. `station.station_exposure` : adaptateur aux
DayBatch Task 11. `load_rule` : config sourcée/versionnée, formats inconnus refusés.
`apps/web/features/cattle/thi.ts` : calcul web pur avec golden partagé Python/web,
y compris changements d'heure Europe/Paris. Les résultats sont locaux au module,
séparés des contrats V1 de risque ; pas de persistance scientifique ajoutée.

[Formule, référence réellement consultée, seuils et limites](../../../../docs/codex/verification/task14/METHOD.md).

```sh
python scripts/cattle_heat_stress.py --input work/station-export.json \
  --station 31069001 --from 2026-09-01 --to 2026-09-30 --resolution daily
python -m pytest engine/tests/cattle
```

L'input est un export Task 11 `/api/weather/series?mode=live_meteofrance&...`
ou une liste de DayBatch normalisés. Aucun accès DB ou réseau depuis ce calcul.
Sortie JSON explicable avec statut unavailable/insufficient/available,
provenance, paramètres, source et limites ; stdout redirigeable pour revue.

Web : `/?mode=live_meteofrance&production=cattle&indicator=thi`, puis liens
Diagnostic/Watch conservant station, support et période. `product=auto` par défaut,
ou `climatology` / `observations` explicitement. Le mode auto utilise des horaires
complets quand disponibles, sinon THI(TM,UM) synthétique avec flag. Humidité absente :
aucun THI calculé. Une absence de dépassement ne permet pas de conclure sur l'animal.
Les résultats climatiques ne prouvent ni présence de bovins ni sensibilité locale.
