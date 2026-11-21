# Contrats scientifiques et 1 185 recalculs

Les 1 185 recalculs portent `multiproduction-agro03-1.0.0`. Les cibles actives sont `agroclimatic-1.3.0` et `multiproduction-descriptive-1.0.0`. L’adaptateur PREV-01 v1 compare le contenu intégral des deux règles à leurs registres respectifs et exige l’égalité de tous leurs champs hors version. Il lit le sidecar avec la règle source intégrale et restitue le résultat sans changer sa version, sa valeur, ses flags ni son support.

Les contrats correspondants utilisent le même `calculateQualified`, la même politique `climate-coverage-1` et les mêmes fenêtres calendaires UTC. Les entrées sont en mm, °C et %. L’archive, la journée de validité, la variable, la PRA, le modèle, son initialisation et les empreintes sources doivent correspondre. Les seuils stricts et inclusifs, le cumul, les maxima et les séquences sont vérifiés par le rejeu arithmétique indépendant COUV-05D. La pluie est normalisée sur les mêmes cellules et poids à chaque date. Le THI prend Tmoy et RHmoy compatibles sur le même support, puis applique l’opérateur temporel de la règle. La présence d’un masque ne modifie aucune règle d’admissibilité.

| Règle | Recalculs | Explorer, sélection nationale | Explorer, accès avec choix explicite du modèle | Recette d’édition présente |
| --- | ---: | ---: | ---: | ---: |
| `rain`, `heavy_rain`, `dry`, `dry_sequence` | 105 chacune | 42 chacune | 105 chacune | 105 chacune |
| `thi`, `thi_days`, `thi_sequence` | 80 chacune | 28 chacune | 80 chacune | 80 chacune |
| `rain_frequency` | 105 | 0 | 0 | 105 |
| `wet_days1`, `wet_sequence1`, `rain10_days`, `rain_max1day` | 105 chacune | 0 | 0 | 0 |
| **Total** | **1 185** | **252** | **660** | **765** |

Les **525 refus Explorer** portent sur des règles absentes du registre actif. Dans la sélection nationale, **408** autres résultats ont une source différente de celle requise par la sélection de l’archive. Le paramètre `model` permet une lecture explicite de ces 408 résultats sans modifier la sélection nationale. Parmi les 540 résultats sous 90 %, 96 appartiennent à la sélection nationale, 144 aux autres modèles disponibles pour les règles Explorer et 300 aux règles absentes de son registre. Une pièce d’édition exige également l’identité de la valeur gelée et des entrées capturées. Les 765 correspondances de règle ne constituent pas 765 résultats publiés.

Les 26 400 THI partiels non admissibles et les 660 supports absents ne figurent pas dans le paquet. Les 240 THI retenus satisfont la tolérance scientifique de complétude existante. La fraction de 90 % est un seuil de peinture. Aucun seuil scientifique ni calcul n’a changé.

## Matrice détaillée

Les décisions individuelles avec PRA, modèle, cycle, fenêtre, règle, fraction et empreinte sont écrites sous `work/prev01/scientific.json`. Les identités et valeurs conservées sont vérifiées par le lecteur et le rejeu numérique. La matrice reste hors Git.

```sh
mkdir -p work/prev01
cd apps/web
PREV01_SCIENTIFIC_MATRIX="$(cd ../.. && pwd)/work/prev01/scientific.json" \
  node_modules/.bin/vitest run lib/server/forecast-qualified.real.test.ts \
  lib/server/forecast-residuals.real.test.ts
```

Ce contrôle requiert le paquet authentique reproduit selon le [runbook](DEPLOYMENT.md). Les [preuves numériques d’origine](../COUV-05D/evidence/numeric-report.json) et le [contrat du paquet](../COUV-05E/README.md) restent les références de qualification.
