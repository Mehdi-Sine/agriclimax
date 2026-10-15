# Reproduction et exploitation Wheat MVP

## Modes de stockage explicites

Le mode par défaut lit `apps/web/features/wheat/snapshots.json`, un bundle **serveur**
de calculs sur des données réelles capturées. Il fonctionne sans secret cloud dans
le navigateur ou pendant la consultation. L'interface annonce instantanés, mise à
jour manuelle et absence d'actualisation météo en temps réel. Il ne s'agit pas de
fixtures de démonstration. Chaque entrée exacte est versionnée dans `inputs/`.

`WHEAT_STORAGE=supabase` sélectionne exclusivement la lecture des portefeuilles
persistés via la nouvelle RPC ; une erreur distante ne bascule pas sur le bundle.
La migration correspondante n'a **pas** été appliquée à distance dans cette
exécution : l'approbation automatique l'a refusée, au motif que la création de
tables/fonctions/droits persistants exige une autorisation distante explicite.
Les tests de migration, permissions et replay ont été exécutés dans des bases
Docker jetables locales, sans mutation des données Task11/Task12 distantes.

La migration candidate est `supabase/migrations/20261015140022_wheat_portfolios.sql` :
une table privée append-only, RLS forcée, droits SELECT/INSERT seulement pour
service_role, RPC INVOKER de persistance et lecture bornée, lecture d'entrées
Task11/Task12 en option. Aucune migration existante modifiée. L'application distante
et l'activation de ce mode nécessitent une autorisation séparée. Aucun merge.

## Environnement reproductible

Le dépôt exige pnpm **10.x** et déclare **10.0.0**. Ne pas modifier cette contrainte.
Si le runtime système est en lecture seule, activer les shims et caches dans work :

```sh
mkdir -p work/bin work/corepack work/cache work/data
export COREPACK_HOME="$PWD/work/corepack"
export XDG_CACHE_HOME="$PWD/work/cache"
export XDG_DATA_HOME="$PWD/work/data"
corepack enable --install-directory "$PWD/work/bin"
corepack prepare pnpm@10.0.0 --activate
export PATH="$PWD/work/bin:$PATH"
pnpm --version  # 10.0.0
pnpm install --frozen-lockfile
python -m venv work/venv
work/venv/bin/pip install -r engine/requirements-dev.lock -r engine/requirements-climate.lock -e 'engine[dev,climate]'
export PATH="$PWD/work/venv/bin:$PATH"
make check
```

Les premières tentatives sans caches explicites ont rencontré le système en
lecture seule. L'accès réseau des commandes doit utiliser le contexte réseau
fourni par le runtime, son proxy et ses CA ; aucun contournement du proxy.

## Acquisition et calcul sans écriture distante

`scripts/compute_wheat.py` lit les RPC Task11 **existantes** pour la liste de
stations et les lots `meteofrance-climatology`, puis valide les modèles quotidiens.
Exemple (variables serveur configurées par l'environnement, ne pas les imprimer) :

```sh
python scripts/compute_wheat.py \
  --station 29075001 --start 2026-10-07 --end 2026-10-13 \
  --computed-at 2026-10-15T14:30:00Z \
  --inputs-output work/wheat-inputs/29075001-october.json \
  --output work/wheat-portfolios/29075001-october.json
```

Remplacer `computed-at` par l'instant UTC réel de l'exécution, ou conserver celui
du calcul original pour un replay exact. Il fait partie du reçu immuable.
Les références Task12 peuvent être exportées **en lecture seule**, distinctes
par `(cell_id,dataset_version,valid_date)`, en choisissant la révision la plus
récente `created_at,content_key`. La CLI attend un tableau de `ReferenceDay`, et
exige l'association explicite et sa justification :

```sh
python scripts/compute_wheat.py --station 29075001 \
  --start 2026-09-01 --end 2026-09-03 --computed-at 2026-10-15T14:30:00Z \
  --references work/references.json --grid-cell era5land.48.1.-1.7 \
  --dataset-version cds-snapshot-2026-10-15 \
  --grid-mapping-source 'Contexte technique Task12 distant, non représentatif de Brest' \
  --output work/wheat-portfolios/29075001-september.json
```

Ce dernier exemple vérifie le branchement, pas une anomalie agronomique : les
références locales suffisantes n'existent pas et le garde-fou de distance bloque
les valeurs. Ne pas abaisser le minimum de référence ni élargir la distance pour
obtenir artificiellement une anomalie disponible.

Les paramètres se changent dans un nouveau fichier passé à `--config` ; conserver
une source explicite et versionner ce fichier. Une fenêtre étiquetée par un stade
fourni ajoute `--stage anthese --stage-source 'Relevé utilisateur daté ...'` ; ne
jamais inventer cette observation. Aucun stade réel n'a été fabriqué dans le bundle.

## Replay local exact et publication du bundle

```sh
python scripts/compute_wheat.py --station 05046001 \
  --start 2026-09-01 --end 2026-09-03 \
  --computed-at '<computed_at du portefeuille existant>' \
  --input docs/codex/verification/task13/inputs/05046001-september.json \
  --output work/replay/05046001-september.json
python scripts/bundle_wheat.py --directory work/wheat-portfolios
python scripts/export_wheat_schema.py
make check
```

Le replay `--input` ne nécessite aucun credential. Le test Python de bundle rejoue
les dix portefeuilles et compare exactement les sorties aux entrées capturées.
La publication est une modification de fichier versionné, revue dans la PR.
Ne pas mélanger fixtures synthétiques et calculs réels. Les sources synthétiques
des tests sont isolées sous `engine/tests/wheat` et `supabase/tests/`.

Après autorisation et application de la migration distante, l'option
`--persist-supabase` écrit uniquement le portefeuille Wheat, par clé de contenu
SHA-256. Une erreur de transport se résout par replay des mêmes entrées et du même
`computed-at`. Les tests SQL vérifient premier insert=true, replay=false, collision
rejetée, statut validated rejeté et clients anon/authenticated sans accès.

## Consultation

- `/?mode=wheat` : carte de points, tableau accessible, indicateurs et liens diagnostic.
- `/diagnostic?mode=wheat&station=29075001` : preuves complètes de la station.
- `/watch?mode=wheat` : suivi descriptif, sans signal de risque ni notification.
- `/api/wheat?mode=wheat&start=2026-10-07&end=2026-10-13` : résultats réels normalisés.
- `start`, `end`, `station`, `stage`, `fingerprint` sélectionnent une version publiée.
  Absence de calcul ou de stade fourni = résultat absent. Pas de recalcul web ou
  de remplacement par données fictives. En-têtes no-store et nosniff.

Les périodes livrées sont le **1–3 septembre 2026** et le **7–13 octobre 2026**,
pour Embrun, Marignane, Brest-Guipavas, Toulouse-Blagnac et Strasbourg-Entzheim.
Ce sont cinq points, ni parcelles de blé identifiées, ni carte continue de France.

## Contrôles

`make check` inclut qualité, contrats, Python, lint, typecheck, web et build.
En complément : ruff/mypy strict Wheat, deux variantes SQL `public`/`extensions`,
audits pnpm/pip/browser, gitleaks historique et staged, actionlint,
scan du bundle client et Playwright `tests/e2e/wheat.mjs` (3 tailles × 2 thèmes ×
3 espaces), audit WCAG AA, navigation clavier, fenêtre absente et absence
d'inférence de stade. La CI Quality exécute aussi les contrôles Wheat ajoutés.

Les tests SQL sont locaux uniquement :

```sh
bash supabase/tests/run-local.sh public
bash supabase/tests/run-local.sh extensions
```

Le composant de risque et son V1, le code Task12 et les données persistées des
Tasks11/12 restent inchangés. Les captures/publications ne sont pas une validation
scientifique et ne déclenchent aucune autre Task.
