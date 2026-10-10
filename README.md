# AgriclimaX — Codex Starter v2

> **Observer. Comprendre. Anticiper.**  
> L'observatoire des risques climatiques agricoles.

Ce dépôt est le socle de développement **contract-first** d'AgriclimaX : plateforme scientifique d'observation, de veille et d'anticipation des risques climatiques pour les productions végétales et animales.

## Principes non négociables

1. **Le nom canonique du produit est `AgriclimaX`.** `agriclimax` est utilisé pour les identifiants techniques ne nécessitant pas la casse de marque.
2. **La science et la présentation sont découplées.** Les couleurs UI ne déterminent jamais les seuils scientifiques.
3. **Ne jamais confondre** : aléa (`hazard`), exposition (`exposure`), sensibilité (`sensitivity`), risque (`risk`) et confiance (`confidence`).
4. **Toute conclusion est traçable** jusqu'aux données, paramètres, versions de règles et sources.
5. **L'IA rédige, elle ne fabrique pas les faits.** Les synthèses IA sont dérivées de faits structurés et citent les sources disponibles.
6. **Desktop, tablette et mobile sont trois compositions**, pas un simple redimensionnement.
7. **Le mode démo est isolé et explicitement fictif.**
8. Commencer simple : Next.js + MapLibre + Supabase/PostGIS + Python + GitHub Actions + Vercel. Ajouter une infrastructure seulement après mesure d'un besoin réel.

## Espaces produit

- **Observation** : carte, filtres, couches, comparaison temporelle et territoriale.
- **Veille** : signaux structurés, chronologie, synthèses, fraîcheur, provenance.
- **Diagnostic** : indicateurs, séries, méthodes, seuils, sources, incertitudes.

## Démarrage Codex

Lire `START_HERE_CODEX.md`. Ne pas lancer tous les workstreams avant la fin de la Wave 0.

## Structure

```text
apps/web/                  Next.js App Router + MapLibre
engine/                    moteur scientifique Python
config/                    espèces, indicateurs, règles et sources
contracts/                 schémas versionnés partagés
supabase/                  migrations + SQL/RPC
fixtures/                  données fictives de démonstration
docs/product/              produit et architecture UX
docs/design/               marque et design system
docs/science/              gouvernance scientifique
docs/architecture/         architecture et ADR
docs/codex/tasks/          prompts exécutables par Codex
.github/workflows/          CI + pipeline quotidien
```

## Cibles MVP

Le starter vise une V0 démontrable puis une V1 scientifique. Les premières productions proposées sont blé tendre, maïs, colza, tournesol, vigne, pommier, prairie, bovin lait et bovin viande. Elles restent **provisoires tant qu'elles ne sont pas validées scientifiquement**.

## Installation et contrôles — Task 01

Prérequis : Node.js >= 20.9, pnpm **10.0.0** (via Corepack), Python >= 3.12.
Depuis la racine :

```sh
corepack enable
pnpm install --frozen-lockfile
python -m venv .venv
. .venv/bin/activate
python -m pip install -r engine/requirements-dev.lock -e 'engine[dev]'
pnpm check-contracts
make check
pnpm dev
```

L'installation editable déclare explicitement `engine/src/agriclimax` ; aucun
`PYTHONPATH` n'est nécessaire. Le lint appelle ESLint directement, car Next.js 16
ne fournit plus `next lint`. Les erreurs ne sont pas masquées.
Le lockfile pnpm fixe les résolutions ; `engine/requirements-dev.lock` fixe les
dépendances Python de développement. Le backend de build reste borné par major.
La compatibilité a été vérifiée avec Python 3.12.14 ; aucune matrice multiplateforme
n’est encore exécutée.

La page de fondation utilise uniquement des fixtures locales et affiche
**Données fictives**. Aucun fichier `.env`, compte cloud, secret, police distante
ou connexion Supabase n'est requis. Les valeurs ne constituent pas une conclusion
scientifique validée. Les configurations et seuils du starter sont inchangés.

### Frontières et état partagé

`RiskRepository` expose les données au web core ; `DemoRiskRepository` assure
l'accès local et retourne une copie indépendante explicitement fictive.
`DemoMapRiskLayerAdapter` consomme cette interface sans calcul scientifique.
Les paramètres URL canoniques sont `production`, `indicator`, `date`, `territory`
et `compare` ; les dates sont calendaires ISO, sans conversion de fuseau.
Les paramètres absents ou invalides deviennent `null`. L'ordre de sérialisation
est stable ; les paramètres inconnus sont ignorés. `compare` est transporté,
mais aucun calcul de comparaison n'est implémenté dans cette tâche.

### Contrats V1 gelés

`pnpm check-contracts` valide les trois JSON Schema existants et leurs exemples
sous `fixtures/contracts/`, les formats date/date-time, les marqueurs de démo,
la structure des YAML et les références production/indicateur des règles.
La copie JSON du GeoJSON, nécessaire à l'import TypeScript, doit être identique
à la fixture canonique : le contrôle échoue si elle diverge.
Aucun téléchargement de schéma ni appel externe ne se produit pendant ce contrôle.
Toute évolution de `contracts/` suit `contracts/CONTRACT_CHANGE_PROCESS.md`.
Les objets peu contraints des schémas existants restent une limite connue ;
la validation technique ne vaut pas validation scientifique.

Le typage lance `next typegen` avant `tsc` pour fonctionner sur un checkout neuf.
`next-env.d.ts` est généré et ignoré conformément à la documentation Next.js 16.
Le fichier `apps/web/AGENTS.md` est généré par `next dev` et conservé comme consigne
locale du framework. Le bilan et les captures de validation sont dans
`docs/codex/verification/task01/`.

## Shell et design system — Task 05

`pnpm dev` ouvre le shell de démonstration ; `/design-system` présente les
composants, états, thèmes et assets. Les données sont fictives, sans carte,
moteur de veille ou diagnostic métier. Filtres et navigation partagent le
contexte URL de Task 01. La démo ne nécessite aucune clé ni police distante.
Voir `docs/design/DESIGN_SYSTEM.md` pour les API et
`docs/codex/verification/task05/` pour les preuves responsive/accessibilité.

Après intégration de main Tasks 02–04, le shell peut vérifier un contexte live
explicite avec `?mode=live&production=...&indicator=...&rule=...&version=...&date=...&bbox=...`.
La base vide affiche « Données absentes » sans recours aux fixtures. Les détails
métier live restent à intégrer dans Task 06. Dans l'environnement cloud à proxy,
le serveur Node utilise `NODE_USE_ENV_PROXY=1` comme dans la validation Task 04.

## Qualité transversale — Task 09

`make check` ajoute les guards sécurité/migrations et leurs tests aux checks
Task 01. Les workflows Quality et Security audits couvrent le build, le mode
démo, les contrats, les migrations, les dépendances et la fuite de secrets serveur.
Voir [les commandes, budgets et limites](docs/ops/QUALITY_SECURITY.md) et
[le rapport Task 09](docs/codex/verification/task09/REPORT.md).
Les audits restent bloquants sur les vulnérabilités documentées dans le rapport.
