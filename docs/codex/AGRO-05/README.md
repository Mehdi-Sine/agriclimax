# AGRO-05 — Indicateurs pour les situations agricoles

Dans **Analyse → Situations agricoles**, cinq vues répondent à des questions sur la chaleur disponible pour le maïs, le gel dans une fenêtre sensible, l’interruption des pluies et la quantité ou la concentration des pluies avant des travaux. Les paramètres sont affichés ou documentés et la période est choisie par l’utilisateur. Les calculs décrivent le signal ERA5-Land à l’échelle PRA.

- [Inventaire des calculs existants et nouveaux, couverture observée](INVENTAIRE.md)
- [Cinq fiches scientifiques et indicateurs différés](FICHES.md)
- [Simulation du Journal](JOURNAL.md) et [quinze synthèses structurées](evidence/syntheses.json)
- [Captures des cinq cartes](evidence/browser), [rapport du navigateur](evidence/browser/browser.json)
- [Rejeu national et mesures](evidence/rejeu.json), [couverture par PRA](evidence/couverture-par-pra.csv.gz)

## Intégration

Les calculs reprennent le moteur TypeScript du catalogue Analyse. Trois vues reprennent exactement les formules historiques. Le moteur GDD accepte le plafond documenté pour le maïs et un opérateur calcule le maximum de pluie sur cinq jours consécutifs. La qualification `climate-coverage-1` conserve les 713 identités et exclut les portions du dénominateur des résultats éditoriaux. La carte réutilise le même rendu MapLibre et ses masques. L’acquisition et la préparation nocturne du Journal restent indépendantes de cet export à la demande.

L’export en lecture seule s’obtient depuis le lien sous la carte ou via `/api/agroclimatic?summary=1`. Ajouter `indicator`, `start`, `end` et éventuellement `compare=previous`. La comparaison appariée ne couvre que les fenêtres successives homologues. [Contrat](../../../contracts/jsonschema/agro-field-summary-1.schema.json)

## Recette

Les archives nationales consultables couvraient octobre et novembre 2026. Le rejeu a utilisé le 24–30 octobre, le 10–16 novembre et le 1–30 octobre. Le printemps et l’été sont sans archive nationale admissible dans le catalogue interrogé. Les tests unitaires couvrent les seuils, le plafonnement à 30 °C, les trous du calendrier, les ruptures de support et les comparaisons entre fenêtres. Les 15 exports passent le schéma JSON et les contrôles de dénominateur. Les trois reprises correspondent aux calculs historiques sur les 2 139 comparaisons du 24–30 octobre. Un calcul indépendant à partir des sept lignes natives des Alpes niçoises a retrouvé les cinq résultats du 10–16 novembre, dont 84,3812 mm de cumul et 78,1982 mm pour le pic sur cinq jours.

Les cinq cartes de novembre ont été ouvertes dans Chromium. Les **713 contours** sont rendus, dont les six PRA corses. Le rendu distingue **681 contours entièrement colorés**, **31 colorés sur leur seule portion qualifiée** et **Crozon grisée**. La convention visuelle du seuil de 90 % explique l’écart avec les **645 PRA évaluables** dans la synthèse. La sélection de production au clavier, le lien d’export et les largeurs 1440, 768 et 390 px sont couverts par le test navigateur.

Dans le rapport de rejeu, la qualification et les calculs des cinq vues sur 713 PRA prennent **51 à 204 ms** pour sept jours et **178 à 321 ms** pour trente jours. Le temps complet dépend des lectures d’archives et de la comparaison demandée. Le premier appel de novembre, avec comparaison, a pris **9,5 s**. Les quatre suivants pour les mêmes fenêtres ont pris **1,9 à 2,8 s**. Le cache applicatif partage une fenêtre d’archive lue pendant une minute entre les recettes. Le rapport mesure également le volume avant compression, jusqu’à 4,1 Mo pour le résultat territorial détaillé de 30 jours. L’export HTTP destiné au comité renvoie uniquement la synthèse, qui occupe au plus 21,8 ko lors du rejeu. Ces mesures locales incluent la variabilité d’accès aux archives et la charge de l’environnement.

Depuis la racine, installer les dépendances avec le verrou du dépôt, puis utiliser les accès serveur déjà configurés pour les lectures d’archives. Le rejeu n’écrit que les fichiers de preuve dans le dossier demandé.

```sh
PRA_NATIONAL_ENABLED=1 NODE_OPTIONS=--conditions=react-server \
  apps/web/node_modules/.bin/tsx scripts/agro05_replay.ts
pnpm --filter @agriclimax/web test --testTimeout 20000
pnpm --filter @agriclimax/web typecheck
```

Pour les captures, démarrer l’application sur le port 3018 avec les paramètres d’accès existants. Installer Playwright avec le verrou de `tests/e2e`, puis lancer `node tests/e2e/agro05.mjs`. Les sorties sont écrites dans `work/agro05/browser` par défaut.
