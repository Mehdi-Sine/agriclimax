# Continuité J−1 à J+7 — cycle national

Jour de référence : 6 novembre 2026 ; journées scientifiques **UTC**, distinctes des journées civiles Europe/Paris.

| Journées | Source sélectionnée | Run |
|---|---|---|
|5 novembre J−1|AROME, estimation rétrospective|5 novembre00UTC|
|6 novembre J0, 7 novembre J+1|AROME|6 novembre00UTC|
|8–9 novembre J+2/J+3|ARPEGE|6 novembre00UTC|
|10–13 novembre J+4/J+7|IFS|6 novembre00UTC|

Règle `pra-national-weather-daily-1` : un seul modèle/run par journée, cinq variables. Les vues AROME/ARPEGE/IFS restent disponibles individuellement (respectivement trois, quatre et sept journées). Aucun cumul multi-modèles n'est présenté ; les cumuls individuels exigent des journées disponibles d'un même scénario.

Tous les champs effectivement décodés ont `typeOfGeneratingProcess=2` : **prévisions**. H+0 n'est pas une analyse. Aucune observation/analyse quotidienne J−1 complète accessible n'a été démontrée ; les accès stationnels restent401. La solution réutilise les prévisions antérieures, marquées explicitement dans le contrat et l'interface. Aucun pipeline SAFRAN/SIM redondant n'a été acquis.

Les moyennes sont intégrées sur une journée ; les minima/maxima sont ceux des échantillons temporels, pas des extrêmes continus. Les températures sont converties K→°C, pluie kg/m²→mm ; P1D MF doit représenter exactement24 h. Les différences d'accumulation IFS négatives et RH hors[0,100] deviennent NULL avec motifs, jamais zéro ni écrêtage. Une RH native100,008% existe dans le préflight : elle n'est pas corrigée arbitrairement.

| Validité UTC | Tmoy/Tmin/Tmax chacune | Pluie exploitable /713 | RH exploitable /713 |
|---|---|---|---|
| 2026-11-05 | 713 (100 %) | 713 (100.00 %) | 350 (49.09 %) |
| 2026-11-06 | 713 (100 %) | 713 (100.00 %) | 178 (24.96 %) |
| 2026-11-07 | 713 (100 %) | 713 (100.00 %) | 261 (36.61 %) |
| 2026-11-08 | 713 (100 %) | 713 (100.00 %) | 521 (73.07 %) |
| 2026-11-09 | 713 (100 %) | 713 (100.00 %) | 573 (80.36 %) |
| 2026-11-10 | 713 (100 %) | 713 (100.00 %) | 456 (63.96 %) |
| 2026-11-11 | 713 (100 %) | 519 (72.79 %) | 556 (77.98 %) |
| 2026-11-12 | 713 (100 %) | 713 (100.00 %) | 499 (69.99 %) |
| 2026-11-13 | 713 (100 %) | 713 (100.00 %) | 478 (67.04 %) |

Les 194 NULL de pluie du11 novembre correspondent à des accumulations IFS non monotones. L'humidité a une complétude sensiblement inférieure à celle des températures ; elle ne doit pas être annoncée nationalement complète.

Les comparaisons descriptives AROME/ARPEGE/IFS (effectifs, biais, RMSE sur supports communs) sont dans national-evidence/comparison.json. Elles ne sont pas une validation statistique de J+7. ERA5-Land national s'arrête au30 octobre : aucune date commune avec ce cycle récent. Aucun chiffre station/réanalyse inventé. À poursuivre : archive quotidienne des erreurs par échéance, variable, territoire et saison lorsqu'une vérité de référence est réellement disponible.
