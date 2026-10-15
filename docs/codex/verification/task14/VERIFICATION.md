# Task 14 — Cattle heat stress MVP

## Base et prérequis avant code

Main distant confirmé par GitHub puis fetch :
`ccbf4805bf07f5b3ed3590d8e9c3ca92d51a51c3` (merge Task 12, PR #28).
Worktree `/workspace/agriclimax-task14`, branche `codex/14-cattle-heat-stress`,
identité `Mehdi-Sine <mehdi.sine@acta.asso.fr>` configurée immédiatement.
Avant publication, rebase sans conflit sur `4a99d45511c99491fee6147fc49300662b47b91c`
(merge PR #29 : clôture documentaire Task 12). Diff amont limité à quatre documents,
aucun changement de code testé. Les preuves Task 12 actualisées confirment
l’acquisition réelle et la persistance DEV ; RH reste absente de l’extraction.

Le remote-tracking initial était ancien ; le worktree a été avancé par fast-forward
au main distant confirmé avant code. Aucune modification de main.

Lectures : AGENTS, START_HERE, Tasks 02/11/12/06/07/08/ancien 14,
science.py, indicators.py, evaluator, ingestion/normalisation/pipeline Météo-France,
climatologie/statistiques/comparaisons, gouvernance, contrats et vues existantes.
Le prompt utilisateur définit la Task 14 bovins et remplace ici l'ancien pilote.
Frontières affectées détaillées dans `docs/codex/tasks/14_CATTLE_HEAT_STRESS.md`.

Avant code : `make check` **PASS** (`baseline-check.log`) ; acquisition réelle
Météo-France du 14 octobre, Brest/Toulouse/Marignane : 18 valeurs disponibles sur
18 ; échantillon récent du 15 octobre : 9 sur 9. Température et RH présentes.
Task 12 inspectée : référence thermique/pluie, RH absente de l'extraction ; pas
de THI historique homologue. L'anomalie THI est donc explicitement unavailable,
sans contester l'existence des anomalies thermiques Task 12.

## Livraison et portée scientifique

Configuration versionnée, THI horaire et synthétique quotidien, agrégats horaires
complets seulement, dépassements stricts, jours concernés, épisodes/durée maximale,
cumul, nuits complètes Europe/Paris et gestion DST. Manquants/insuffisance explicites,
aucune humidité inventée, exposition climatique séparée du risque et de l'état animal.
La méthode et ses limites sont détaillées dans [METHOD.md](METHOD.md).

Web : entrée « Bovins · exposition thermique THI » depuis l'observation ; contexte
`mode=live_meteofrance&production=cattle&indicator=thi`, station/période/source
conservés entre Observation Map, Scientific Diagnostic et Watch. Carte de stations
réelles sans interpolation, THI de la station sélectionnée, formulaire accessible,
comptages et preuves complets. Watch relaie les épisodes observés au-dessus du seuil
configuré et renvoie au diagnostic, sans narration/conseil automatique.
L'export Python consomme les DayBatch Task 11 existants. Pas de migration, écriture
DB, nouveau scheduler, modification des contrats V1 ou ajout de dépendance produit.
Le statut livré est exploratory ; reviewed/validated existent dans la configuration
et leur correspondance à la gouvernance est documentée, sans promotion automatique.

## Exemples live et comparaison indépendante

Acquisition réelle en lecture seule par le provider Task 11, 1–30 septembre 2026,
et échantillons récents du 15 octobre. `live-examples.json` conserve période, source,
checksums, fraîcheur, statut, limites et résultats ; CSV de comparaison indépendante
pour les **93 paires réelles** : 90 jours-stations et trois échantillons horaires.
Les inputs complets ont été gardés sous work/ (pas de mutation Supabase).

| Station | Max. THI synthétique journalier | Jours >72 | Épisodes quotidiens | Durée max. (j) | Cumul (THI.j) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Brest 29075001 | 66,18410 | 0 | 0 | 0 | 0 |
| Toulouse 31069001 | 75,45492 | 5 | 2 | 4 | 8,38352 |
| Marignane 13054001 | 76,29877 | 9 | 2 | 8 | 17,23803 |

Ces valeurs sont calculées à partir de TM/UM : elles ne sont **pas** des maxima
horaires ni une mesure du stress d'un animal. Couverture quotidienne 100 % ;
archives stale selon politique Task 11, même acquises aujourd'hui. L'échantillon
horaire récent couvre 1/24 (4,17 %) par station : `insufficient`, pas de moyenne/max
journalier ou récupération nocturne affirmés. Les chiffres récents décrivent la
récupération du 15 octobre, pas un engagement de fraîcheur permanent.

Vérification arithmétique indépendante par Decimal : équation développée
`0.81*T + 46.3 + 0.0099*RH*T - 0.143*RH`, erreur absolue <1e-10 sur les 93 paires.
Cas manuel connu : T=30 °C, RH=50 % → `86 - 0.275*28 = 78.3`.

## Vérifications finales

- **87 tests Python PASS**, dont 13 bovins : valeur connue, comparaison manuelle,
  seuil exact, heures, épisode continu/trou, cumul, récupération nocturne,
  RH absente, station étrangère, unité/résolution/source/demo invalides, config.
- **142 tests web PASS**, dont 15 bovins : même arithmétique, couverture/épisodes,
  égalité, récupération, absence RH, validation, fallback journalier et sélection
  horaire complet. Golden partagé Python/web : été, DST printemps/automne, manquant.
- Ruff et mypy strict nouveaux modules/CLI PASS ; intégrés au workflow qualité.
- Lint, typecheck, build et **make check PASS** ; contrats V1 et garde migrations PASS.
- Trois parcours réels × desktop 1440/mobile 390 : HTTP 200, contexte conservé,
  absence de débordement, **0 violation axe WCAG A/AA/2.1 AA** ; captures et JSON.
  État horaire absent vérifié. Inspection visuelle desktop et mobile effectuée.
- Smoke HTTP existant PASS ; **30 états intégration/responsive/AA existants PASS**.
- Audits Python moteur/climatologie/outillage : zéro vulnérabilité connue.
  JS production et outillage navigateur : zéro. JS global : unique exception
  préexistante GHSA-vfj7-8cjw-p6xm (braces 3.0.3, chaîne ESLint), contrôlée par
  audit-exceptions ; aucun chemin production. Aucun lockfile/dépendance modifié.
- Scan valeurs de secrets client, guard bundle et budget PASS (voir budget.log).
- Gitleaks historique et diff préparé : rapports joints ; `git diff --check` PASS.

Limites de validation : warnings NumPy/netCDF4 préexistants (23), conservés dans
les logs ; aucune nouvelle validation clinique/zootechnique, campagne experte ou
couverture horaire réelle complète prétendue. Les nuits complètes sont vérifiées
sur séries de tests explicitement synthétiques ; les exemples live restent insuffisants
pour cela. Les dépendances du runtime d'audit restent dans work/, hors produit.
Le proxy HTTP hérité est utilisé pour les acquisitions ; Node local lancé avec
`NODE_USE_ENV_PROXY=1` pour lire Supabase dans cet environnement. Changelog Supabase
inaccessible via outil web (type markdown non supporté), documentation courante
consultée via search_docs ; aucun schéma ou mécanisme d'authentification modifié.

## Reproduction

```sh
make check
python -m ruff check engine/src/agriclimax/cattle engine/tests/cattle scripts/cattle_heat_stress.py
python -m mypy --strict engine/src/agriclimax/cattle scripts/cattle_heat_stress.py
node tests/e2e/cattle.mjs
```

Le test navigateur nécessite un serveur local buildé, les bindings Task 11 réels
et Chromium (`CHROMIUM_EXECUTABLE` optionnel). Les tests unitaires restent hors
réseau. Formule/règle/config/source exactes sont présentes dans chaque résultat.

## Reprise après merge Task 13

Voir [le rapport de rebase et de vérification d'intégration](rebase-task13/VERIFICATION.md)
pour la base main actualisée, la correction E2E et les contrôles blé/bovins.
Les chiffres et logs ci-dessus décrivent la livraison initiale.
