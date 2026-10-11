# Task 08 — diagnostic scientifique

Branche : `codex/08-scientific-diagnostic` (nom demandé par l’utilisateur,
prioritaire sur le nom du fichier task). Base : dernier `origin/main` vérifié
par fetch, `be3711e`, contenant Tasks 01–05 et 09.

## Frontières et réalisation

Diagnostic possède l’explication, Web core les deep-links. Le loader serveur
réutilise le repository/API Task 04 et sa validation JSON Schema. Design system
possède badges, états, panneaux et drawer. Aucun calcul scientifique, seuil,
contrat, configuration, moteur ou migration n’est modifié.

Le diagnostic du shell est remplacé par une composition métier commune au drawer
et à `/diagnostic`. Desktop : contexte à gauche et panneau expert à droite.
Mobile : page dédiée ; le drawer du shell conserve la surface plein écran du
design system. Aucun travail cartographique Task 06 n’est entrepris.

Identité partageable : `mode`, `cell`, `production`, `indicator`, `date`, `rule`,
`version`. Les liens du shell conservent territoire, comparaison, bbox et zoom.
Les résultats live de lecture carte exposent leur propre lien. Retour et
historique conservent le contexte de l’observation.

`start`/`end` consultent la série via le repository existant, avec sa borne de
365 jours d’écart (366 dates inclusives). Sans période, seule la date choisie
est demandée. La fenêtre de calcul est affichée depuis les champs
`quality.window_start/window_end`, sans être dérivée de la période consultée.
Le tableau affiche chaque valeur reçue avec unité, risque, confiance et fraîcheur,
sans interpolation, agrégation ou tendance inventée.

Hazard, exposure, sensitivity, risk, confidence, freshness, qualité, règle/version,
fenêtre, provenance, statut et limites sont distincts. Les objets exposition et
sensibilité sont restitués avec leurs champs ; absents ou vides, ils sont
« Non disponible », jamais zéro. Zéro et false restent visibles. Flags et motifs
originaux sont conservés. `missing_data` affiche explicitement insufficient.
Unavailable ne devient pas un faible risque ; low ne devient pas no-risk.

## Limites scientifiques et produit

V1 ne transporte pas les seuils, équation, paramètres, limites spécifiques,
URL de méthode ou nature observation/calcul/prévision. Ces absences sont annoncées.
Le lien de gouvernance est une documentation générale, sans prétendre documenter
la méthode exacte. Le statut scientifique de confidence est restitué sans
l’inférer comme statut distinct de la règle. Les timestamps sont affichés en UTC
explicite ; validité/fenêtre sont des dates calendaires. Aucun seuil de fraîcheur.

La démo utilise l’unique résultat existant, fictif et exploratoire. Sa série est
annoncée insuffisante pour une tendance. Le live ne bascule jamais vers la démo.
Les métadonnées libres sont du texte React, sans HTML actif ni URL arbitraire
cliquable. L’absence d’URL méthode n’est pas compensée par une source inventée.

Le contrat ne fournit pas processing ou calculation-error pour un résultat en
cours : ils ne sont pas inventés depuis une collection vide. Les primitives et
leurs tests conservent ces états. Chargement utilise `loading.tsx`. Missing,
source-error, insufficient, stale et demo ont des vérifications spécifiques.
Les erreurs upstream sont masquées.

Le correctif du nom accessible du logo partagé retire l’aria-label qui masquait
une partie du texte visible. Nécessaire au diagnostic, il corrige l’anomalie
WCAG 2.5.3 déjà signalée par Task 09.

## Reproduction

Node >=20.9, pnpm **10.x**, venv avec lockfiles Python existants. Le pnpm global
était 11 ; pnpm 10 a été installé sous `work/`, son bin ajouté au PATH pour les
scripts imbriqués. Aucun manifeste/lockfile n’a été changé.

```sh
make check
pnpm test
pnpm build
python scripts/quality/security.py --bundle apps/web/.next/static
# Serveur production sur 127.0.0.1:3000
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/demo.mjs
DIAGNOSTIC_ARTIFACTS=docs/codex/verification/task08/screenshots node tests/e2e/diagnostic.mjs
```

Résultats : [RESULTS.md](RESULTS.md). Captures : `screenshots/`, régression du
shell : `shell-regression/`. Axe ne constitue pas une certification WCAG.
