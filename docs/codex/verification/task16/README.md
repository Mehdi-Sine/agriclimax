# Task 16 — validation réelle sur Supabase DEV

**Verdict final : parcours réels fonctionnels, validation globale BLOQUÉE par la
minimisation du payload client du diagnostic.** Aucune correction applicative
réalisée pendant cette reprise, conformément à la demande de validation seule.

Validation du 16 octobre 2026 sur `codex/16-live-risk-integration`, code applicatif
`8cc6c61c06cdd7389ee9dd566bb190a9da50e000`. La migration
`20261016135913_daily_live_read.sql` a été installée sur DEV par l'utilisateur
avant ce passage. Sa présence et son exécution ont été vérifiées ; aucune
migration distante, écriture de données, acquisition ou exécution quotidienne
n'a été déclenchée ici. Aucun changement des règles scientifiques.

## Résultats

- **PASS** : `agriclimax_read_daily()` renvoie la dernière publication réussie,
  avec la même publication dans `latest` et `selected` sans dates explicites.
  Exécution interdite aux rôles anon/authenticated.
- **PASS** : blé et bovins réels sur carte, diagnostic, historique et veille,
  desktop 1440 et mobile 390 ; contexte URL conservé, sources/provenance,
  fraîcheur et publication visibles ; zéro violation WCAG AA et aucun débordement.
- **PASS** : agrégats affichés comparés aux lectures SQL bornées de DEV. À Brest,
  22,4 mm de précipitations et 0 jour de dépassement THI pour le 11–13 octobre.
- **PASS** : la dernière publication valide reste lisible malgré sa période
  ancienne et porte `stale`. Les fenêtres absentes récentes ou historiques
  restent absentes, même avec `WHEAT_STORAGE=snapshots`. Déconnexion : erreur
  explicite et aucun marqueur de fixture.
- **PASS** : `make check`, 144 tests Python, 198 tests web, lint, typage, build,
  contrôles qualité/contrats, SQL public/extensions et audits de dépendances,
  secrets, bundle, budget, migrations et workflows.
- **FAIL** : le diagnostic transmet le résultat sélectionné complet dans un
  `<pre>` JSON, au lieu des seuls agrégats nécessaires. Le bloc est déjà présent
  dans la réponse/DOM, même si `<details>` est fermé. Pour le blé : dix indicateurs,
  paramètres et provenance ; pour les bovins : résultat, série THI et provenance.
  Constat reproduit dans les deux tailles d'écran. Aucune clé secrète ni requête
  directe du navigateur vers Supabase détectée ; cela ne lève pas le défaut de
  minimisation. Aucune correction faite dans cette reprise.

## Publication réelle observée

Une publication réussie, cinq stations par production, fenêtre **11–13 octobre
2026**, calcul du **16 octobre 2026 à 13:48:14 UTC** (15:48 heure de Paris).
Son empreinte est
`2b38b57e1e63ea2666da8c6f64b303127d84610dbd1a51f3343558ca0f0531ec`.
La fraîcheur est ancienne selon la période météo, malgré le calcul récent.
L'instant exact de publication et le statut du dernier run ne sont pas stockés
par Task 17 : l'interface les indique inconnus.

Une seule publication réelle existe : son maintien comme dernière valide et sa
lecture par défaut ont été testés en réel. Aucun échec de run n'a été provoqué
sur DEV. La conservation après échec de publication/acquisition est complétée
par les tests SQL et E2E isolés relancés, sans présenter cette simulation comme
un échec réellement observé sur DEV.

## Preuves et reproduction

Voir [le rapport détaillé](final-dev/VERIFICATION.md),
[les E2E réels](final-dev/real-e2e.json),
[les contrôles de fenêtres et d'agrégats](final-dev/real-boundaries.json) et
[l'audit de minimisation client](final-dev/privacy.json).
Les captures de traçabilité et des quatre vues sont dans `final-dev/`.
Aucun payload privé complet, corps HTML/RSC, secret ou HAR n'a été enregistré
dans ces preuves ; l'audit client conserve uniquement les noms de champs et
les compteurs, pas le JSON exposé par l'application.

```sh
PYTHONPATH=engine/src make check
# Environnement serveur connecté à Supabase DEV ; build réalisé par make check.
NODE_USE_ENV_PROXY=1 pnpm --filter @agriclimax/web exec next start --hostname 127.0.0.1 --port 3017
E2E_BASE_URL=http://127.0.0.1:3017 E2E_LIVE_ARTIFACTS=work/task16-final/live node tests/e2e/live-risk.mjs
node tests/e2e/daily-risk.mjs
PYTHONPATH=engine/src bash supabase/tests/run-local.sh public
PYTHONPATH=engine/src bash supabase/tests/run-local.sh extensions
```

Les preuves `rebase-task17/` concernent le passage antérieur à l'installation de
la RPC. La limite « migration non installée / E2E réels non exécutés » de ce
passage précédent est levée par les preuves `final-dev/`, sans lever le nouveau
blocage de minimisation. PR #34 maintenue draft ; aucun merge ni déploiement.
