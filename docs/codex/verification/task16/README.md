# Task 16 — intégration des publications quotidiennes

Branche `codex/16-live-risk-integration`, rebasée sans conflit sur `main`
`5160f9b` (Task 17 et correctifs des Tasks 17/#36/#37 inclus). Identité Git :
Mehdi-Sine <mehdi.sine@acta.asso.fr>. PR #34 conservée draft, aucun merge.

## Comportement

Carte, diagnostic, historique et veille lisent le même snapshot quotidien Task 17
réussi, pour le blé et les bovins. Aucun recalcul THI lors d'une lecture live,
aucune lecture des observations brutes susceptible d'avoir été partiellement
persistées avant un échec. Aucun recours au bundle local ou aux fixtures, y
compris avec `WHEAT_STORAGE=snapshots`.

Sans période explicite, la dernière fenêtre publiée est sélectionnée. Une période
explicite ne lit que sa fenêtre exacte ; absence de fenêtre, station, stade ou
paramètres compatibles = absence explicite. Les séries horaires bovines ne sont
pas publiées par Task 17 : demander le support horaire reste indisponible, sans
substitution quotidienne. Les anciens modes explicitement démo et instantanés
`mode=wheat` gardent leur comportement distinct.

La carte montre les valeurs publiées de l'indicateur choisi pour chaque station.
Les quatre espaces préservent production, station, indicateur et période. Sources,
récupérations, fraîcheur, qualité, versions et limites restent visibles. Les
indicateurs ne sont pas des risques agronomiques complets. Aucune règle,
configuration scientifique ou contrat scientifique modifié.

La fraîcheur vieillit à partir de la fin de la période source (48 h, convention
technique existante), même si le calcul vient d'être publié. La dernière
publication réussie et celle de la sélection sont distinguées. `computed_at` est
la date du calcul : Task 17 n'enregistre pas l'instant exact de publication DB,
qui est donc explicitement inconnu. L'état du dernier run n'est pas enregistré
par cette table : l'UI l'indique inconnu, sans déduire un succès du run à partir
de la présence d'une publication. Un run raté ne masque jamais une publication
précédente ; celle-ci peut rester visible et ancienne. Les logs Actions restent
la source de statut du run.

## Lecture DB et déploiement

Migration additive `20261016135913_daily_live_read.sql` : RPC
`agriclimax_read_daily(date,date)`, invoker, search_path fixe, timeout 5 s,
lecture bornée à deux snapshots (dernier réussi + sélection exacte), exécution
réservée à `service_role`. Aucun droit anon/authenticated ajouté. Les migrations
appliquées et le pipeline d'écriture restent inchangés. L'adaptateur serveur
valide taille, versions, paires station, fenêtres, paramètres blé et champs THI
consommés avant affichage. Aucun secret rendu côté client, transport sans cache.

**Prérequis de déploiement : appliquer cette nouvelle migration avant d'activer
la version web.** Aucune migration distante ni déploiement effectués dans ce
travail. La RPC n'existe pas encore sur le projet réel ; avant installation,
l'interface signale « Publication quotidienne indisponible », sans secours.

## Vérification réelle ciblée — 16 octobre 2026

Lectures SQL limitées aux métadonnées et agrégats, sans exporter les payloads :
une publication réussie, cinq stations blé appariées aux cinq résultats THI
quotidiens ; fin de fenêtre 2026-10-13 ; calcul 2026-10-16 13:48:14.270668 UTC
(15:48 heure de Paris). Identifiant :
`2b38b57e1e63ea2666da8c6f64b303127d84610dbd1a51f3343558ca0f0531ec`.
Fenêtres et timestamps cohérents, provenance non démo confirmée par agrégats.
Cette publication est ancienne selon sa période météo, malgré son calcul récent.

L'export du payload privé intégral a été refusé par le contrôle automatique
(périmètre de vérification / destination non vérifiée). Il n'a pas été réalisé.
Les contrôles ciblés ci-dessus constituent l'alternative autorisée. Les E2E
quotidiens utilisent une publication **synthétique** de test et ne prouvent pas
une disponibilité UI de production après déploiement de la migration.

## Reproduction et résultats

```sh
pnpm install --frozen-lockfile
PYTHONPATH=engine/src make check
PYTHONPATH=engine/src bash supabase/tests/run-local.sh public
PYTHONPATH=engine/src bash supabase/tests/run-local.sh extensions
node tests/e2e/daily-risk.mjs
# Serveur production local pour les régressions existantes :
pnpm --filter @agriclimax/web exec next start --hostname 127.0.0.1
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/demo.mjs
node tests/e2e/integration.mjs
node tests/e2e/wheat.mjs
E2E_DISCONNECTED_ONLY=1 node tests/e2e/live-risk.mjs
```

- `make check` : 144 tests Python, 198 tests web, qualité, contrats, lint,
  typecheck, build et portée d'exception d'audit.
- SQL local jetable : public et extensions PASS. Publication/replay, rollback,
  conservation de la dernière publication après refus, fenêtre exacte et droits.
- Audits JS et navigateur PASS ; exception préexistante GHSA-vfj7-8cjw-p6xm
  uniquement dans l'outillage de développement, aucun chemin production.
- Audit Python des trois lockfiles : aucune vulnérabilité connue.
- Ruff/mypy pipeline, actionlint, gitleaks historique, sécurité bundle/clefs client,
  budget JS/CSS et contrôle forward-only passent.
- E2E quotidien : source HTTPS isolée, build production, desktop 1440 et mobile
  390 ; blé/bovins et quatre vues ; fraîcheur, provenance, sélection partagée,
  dernière publication, absence, déconnexion et conservation après échec simulé ;
  contrôles WCAG AA et débordement horizontal. Intégré à la CI Quality.

Les preuves du nouveau passage sont dans `rebase-task17/`. Les anciens rapports
et captures au même niveau datent de la validation Task 16 antérieure à Task 17
et ne constituent pas une preuve de lecture du pipeline quotidien actuel.
