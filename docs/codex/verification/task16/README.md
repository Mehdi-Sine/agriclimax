# Task 16 — intégration live

Base : dernier main `8b73bfdff10054d36c999857ce32824dd2ba98b4`, incluant Task 15.
Branche : `codex/16-live-risk-integration`. Aucun merge.

## Parcours et responsabilités

`/` sans mode, `mode=live` et `mode=live_meteofrance` ouvrent le parcours live
commun. Les anciens résultats de risque avec `mode=live&rule=...` conservent leur
parcours versionné existant. `production=wheat|cattle`, `indicator`, `start`, `end`, `station`, support
temporel bovins et paramètres blé traversent carte, diagnostic, `/history`, veille.
Le formulaire réinitialise l'indicateur lors d'un changement de production.
Une sélection invalide est affichée en erreur ; aucune règle d'une autre
production n'est exécutée. La sélection d'une station sans calcul reste absente.

Les lectures réutilisent les transports validés et sans cache Tasks 11/13/14.
Le blé impose `WheatRepository` même si `WHEAT_STORAGE` ne vaut pas `supabase`.
Aucun changement des règles scientifiques, des contrats gelés ou du schéma SQL.
Aucune écriture Supabase, acquisition supplémentaire ou déploiement.
Les anciens `mode=demo` et `mode=wheat` restent explicites et séparés ; le second
conserve sa mention d'instantanés réels locaux et n'est jamais un secours live.

Carte SVG avec points station, valeurs de l'indicateur demandé et tableau de
sélection accessible. Aucune interpolation. Pour les bovins, seule la station
sélectionnée est calculée ; les autres points invitent à la sélection, sans
valeur inventée. Points de catalogue et présence de données sont distincts.
Les trois mailles acquises en Task 15 ne sont pas utilisées pour combler des
stations. Référence nationale 1991–2020 non constituée : anomalies indisponibles.

Historique blé : calcul publié pour la fenêtre demandée, date du calcul,
fraîcheur et changement de fenêtre ; aucun cumul transformé en série quotidienne.
Historique bovins : synthèses quotidiennes avec trous conservés, résolution et
couverture explicites. Les épisodes restent des métriques de période.
Veille descriptive, aucun risque agronomique complet ou conseil clinique.
Source, période UTC, récupération source, fraîcheur, statut exploratoire,
indisponibilité et limites visibles dans chaque espace, même en erreur.

## Fenêtres vérifiées en lecture seule

- Blé : `05046001` Embrun, 2026-10-07 — 2026-10-13, paramètres Task13 par défaut.
- Bovins : `31069001` Toulouse, 2026-09-01 — 2026-09-30, THI synthétique 75,45.
- Catalogue Task15 : 15 stations reçues, sans promesse de données complètes.
- La requête blé 2026-09-01 — 2026-09-03 renvoie zéro calcul **persisté**.
  Les cinq calculs du bundle ne sont donc pas affichés en live pour cette période.

Des raccourcis nomment ces fenêtres historiques ; les dates restent visibles et
les valeurs vieillissent. Par défaut la date est hier UTC, donc une absence
récente reste une absence explicite.

## Reproduction

```sh
pnpm install --frozen-lockfile
PYTHONPATH=engine/src make check
pnpm build
# Dans un terminal avec les variables serveur habituelles :
NODE_USE_ENV_PROXY=1 pnpm --filter @agriclimax/web exec next start -H 127.0.0.1
# Facultatif pour tester la source déconnectée, autre terminal :
env -u SUPABASE_SECRET_KEY pnpm --filter @agriclimax/web exec next start -H 127.0.0.1 -p 3001
E2E_UNAVAILABLE_BASE_URL=http://127.0.0.1:3001 pnpm test-e2e-live
```

`NODE_USE_ENV_PROXY=1` concerne le fetch Node 24 de cet environnement. Aucun secret
n'est envoyé au navigateur ni conservé dans les preuves. Les E2E live attendent
les fenêtres réelles ci-dessus, sans interception réseau ou données simulées.
Les tests unitaires simulent uniquement les frontières de transport pour les
cas d'erreur, d'absence, de sélection et d'indicateur.

## Preuves

`make-check.log` : qualité, sécurité, contrats, Python, lint, TypeScript, tests web,
build et exception d'audit existante. `e2e.log`, `browser-report.json` et captures :
parcours réels desktop 1440 px / mobile 390 px, changement d'indicateur/production,
carte, sélection, diagnostic, historique, veille, anomalies indisponibles,
fenêtre absente, contexte invalide, aucune exception navigateur, absence de
débordement horizontal et axe WCAG AA. Le serveur sans clé vérifie l'absence de
remplacement lors d'une déconnexion de source.

CI : le smoke démo utilise désormais `mode=demo` explicitement. Le contrôle E2E
de source déconnectée tourne sans credentials dans `quality.yml` ; les preuves
live de cette livraison ont été obtenues séparément avec les données réelles.

Résultats finaux : `make check` passe (116 tests Python, 189 tests web).
Les E2E live passent sur 1440/390 px, thèmes clair/sombre, sans erreur navigateur
ni violation WCAG AA. La régression démo passe sur desktop/tablette/mobile ;
les 30 états de l’ancienne intégration passent. Budget client : 568 837 octets
gzip pour 2 097 152 autorisés. Aucun nouveau chemin de dépendance de production
couvert par l’exception d’audit existante.

La régression des instantanés blé explicites passe également : 18 audits
responsive/thème/vue, API et navigation, sans requête distante du navigateur.
`ci-disconnected.log` valide la commande CI sans credentials.
