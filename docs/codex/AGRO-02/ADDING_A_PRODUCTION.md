# Ajouter une production

1. Définir une entrée dans `PRODUCTIONS` de
   `apps/web/features/multiproduction/registry.ts` : ID stable, nom, famille,
   recettes applicables et limites propres à la production. Une réutilisation de
   pluie ou de température ne nécessite aucun calculateur supplémentaire.
2. Si les paramètres diffèrent, créer une recette explicite dans `RECIPES`, avec
   un identifiant distinct et la base/le seuil dans `kernel.threshold`. Ne pas
   modifier silencieusement une recette publiée. Versionner le contrat lors d’une
   évolution scientifique ; mettre à jour le schéma et l’export du catalogue.
3. Vérifier formule, unité, variable requise, famille de couverture CORE-01,
   fenêtre UTC, sources effectivement disponibles, niveau scientifique et réserves.
   Une nouvelle interprétation de stress, stade ou dommage nécessite un modèle et
   une validation spécifiques ; elle est refusée par ce registre descriptif.
4. Pour une nouvelle variable, ajouter un adaptateur qui vérifie la métadonnée
   temporelle, l’unité et l’identité spatiale/source/run de **cette variable**.
   Ne pas combiner des lignes ou unités hétérogènes. Pour T/RH, fournir les deux
   preuves `pair_evidence` ; ne jamais remplacer une humidité absente.
5. Tester seuil exact, valeurs extrêmes, journée absente, changement de source,
   grille/run/méthode, support partiel, jours nuls, période incomplète et partage
   avec les autres productions. Comparer à une formule indépendante.
6. Exécuter le pilote national hors de l’ordonnancement, examiner les 713 sorties,
   les motifs d’indisponibilité, la mémoire et les comptes de publication. Ne pas
   convertir une disponibilité théorique du catalogue en promesse nationale.
7. `createContributors` découvre automatiquement l’entrée. Aucun ajout de liste
   dans le Journal. JOUR-02 sélectionnera les lots de l’édition et branchera la
   fabrique. UX-01 intégrera l’interface. Ce changement ne publie aucune donnée.

## Utilisation côté service

```ts
const provider = await historicalProvider(verifiedArchivedDays);
const batch = computeBatch(praIds, ['2026-11-03', '2026-11-03'], provider);
const contributors = createContributors(batch.measurements, places);
// Préparation uniquement : transmettre à JOUR-02 après sélection du lot.
```

Les adaptateurs sont dans `multiproduction/archives.ts`, le calcul pur dans
`multiproduction/engine.ts`, les contrats/faits dans `multiproduction/editorial.ts`.
Le fournisseur d’entrées est appelé pour un ensemble de variables par PRA, indépendamment de la production et du seuil.
Le résultat partagé est immuable. Pour produire une variante locale, créer une
copie explicite ; ne pas essayer de changer une valeur ou ses preuves en place.

## Reproduire la validation

Avec Node ≥20.9, pnpm **10** et les dépendances Python de développement,
climat/geo, `openpyxl` et `py7zr` installées dans un environnement local :

```bash
pnpm install --frozen-lockfile
AGRO02_EVIDENCE=1 pnpm --filter @agriclimax/web test features/multiproduction
NODE_USE_ENV_PROXY=1 AGRO02_REAL=1 pnpm --filter @agriclimax/web test features/multiproduction/archives.real.test.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
python -m pytest engine/tests
python scripts/check_contracts.py
python scripts/quality/check_automation.py
python scripts/quality/security.py
python scripts/quality/security.py --bundle apps/web/.next/static
python scripts/quality/migrations.py
python scripts/quality/budget.py
node scripts/quality/audit-exceptions.mjs --build
```

`NODE_USE_ENV_PROXY=1` correspond au runtime Node 24 du pilote cloud et n’ajoute
aucun secret. Le test d’archives réelles est explicite : une défaillance réseau
échoue, sans substitution par des données synthétiques. Le pilote gelé utilise
les véritables entrées CORE-01 contrôlées par empreinte dans son rapport ; il est
reproductible hors ligne et ne prétend pas être un relevé de disponibilité actuel.
Le validateur Python indépendant est `reference.py`, sans imports applicatifs.
