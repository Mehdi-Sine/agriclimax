# Livraison V0.1

- Branche : `codex/10-integration-v01`, base `main c2b203a` (Tasks 01–09).
- [PR draft #26 vers main](https://github.com/Mehdi-Sine/agriclimax/pull/26).
- [Preview de branche](https://agriclimax-git-codex-10-integration-v01-mehdi-sines-projects.vercel.app).
- [Premier déploiement Vercel réussi du code livré](https://vercel.com/mehdi-sines-projects/agriclimax/89GZznmCokTL9Msjnsf6GwLZKnmd),
  commit `9fa6b2d9fa6466b9135a70643ef04ef18f8b1daa`.
- Aucun merge, push main, changement de contrat/science/RLS/migration ou seed DEV.

La Preview est créée par l’intégration GitHub/Vercel existante. Le statut Vercel
sur le commit applicatif est success (« Deployment has completed »). Chaque push redéclenche cette intégration ; l’alias de Preview suit la branche.
Les checks et le déploiement du dernier commit sont consultables dans la PR,
sans dépendre d’un SHA inscrit dans son propre contenu.

## Reprise des validations — 11 octobre 2026

Branche existante récupérée au commit `7fd4ff52da72c2cfb60a96f870719f15ffbf55fa`.
Aucune reprise d’implémentation. Frontières concernées : validation distante et
preuves documentaires uniquement.

L’autorisation réseau est effective pour les requêtes réalisées : la Preview
répond désormais HTTP **302** sur observation (`/?mode=demo`), diagnostic demo
et veille (`/watch?mode=demo`). Les trois redirections pointent vers
`https://vercel.com/sso-api` : la protection Vercel Authentication empêche
l’accès à l’application depuis cette session. Le précédent refus CONNECT 403
est levé ; les parcours et captures navigateur de Preview restent non validés.
Cette limite est explicitement acceptée comme **non bloquante pour Task 10**
par le demandeur. La validation navigateur distante n’est pas revendiquée.
La protection Vercel Authentication et les configurations de sécurité sont conservées.

Contrôle GitHub en lecture seule à 19:36 UTC : PR #26 ouverte et draft, SHA
identique à la branche récupérée. Les neuf jobs Quality/Security sont SUCCESS :
guards, python-contracts, web-demo, sql (public), sql (extensions), secrets,
js-dependencies, python-dependencies et browser-dependencies. Le statut Vercel
et Vercel Preview Comments sont aussi SUCCESS. Le déploiement associé est
[2QA5Qw8Rv5Mp18knqknWu64Trya7](https://vercel.com/mehdi-sines-projects/agriclimax/2QA5Qw8Rv5Mp18knqknWu64Trya7).
Les validations déjà réussies n’ont pas été relancées.

Commandes : `git ls-remote`, `git fetch origin codex/10-integration-v01`, checkout
local de la branche existante, `gh pr view 26 --json headRefOid,state,isDraft,statusCheckRollup`,
HEAD puis GET `curl` des trois parcours. Les appels réseau ont utilisé la
permission réseau de commande et le proxy hérité. Preuves sans cookies, nonce
SSO ni secrets : `resume-remote-validation.json`.

La finalisation porte uniquement sur la documentation et ses preuves : commit et
push sur la branche existante, mise à jour de la PR draft #26. Aucun merge ni
changement applicatif, DB, contrat, protection Vercel ou configuration de sécurité.

## Checks

Les suites locales complètes passent ; preuves dans VERIFICATION.md et les logs.
La PR exécute Quality (guards, Python/contrats, web-demo et SQL public/extensions)
et Security audits (secrets, dépendances JS/Python/navigateur).
Les SQL historiques utilisent exclusivement leurs conteneurs jetables ; aucun
seed de la base Supabase DEV ou donnée métier réelle n’est effectué par Task 10.
Le contrôle DEV est le SQL en lecture seule `integration-empty.sql`.

Le suivi final des checks est attaché à la PR et résumé dans la livraison au
lecteur. Les checks requis ne sont ni désactivés ni ignorés pour la draft.

## Finalisation locale et suivi CI

Relecture des preuves locales existantes : `make check`, E2E shell, observation,
diagnostic et intégration réussis ; 30 états d’intégration/responsive/AA dans les
modes réel et CI. Couverture des guards 82 %, budget client 565449 octets gzip
pour 2097152 autorisés. Ces validations ne nécessitent pas de nouvelle exécution
pour une modification exclusivement documentaire.

À la finalisation, contrôles locaux relancés avec succès :
`python scripts/quality/security.py`, `python scripts/quality/migrations.py`,
`python scripts/quality/check_automation.py`, `python scripts/check_contracts.py`
et `git diff --check`. Les checks CI seront vérifiés sur le commit documentaire
poussé ; leur statut courant fait autorité dans la PR. Task 10 est finalisée avec
la limitation de Preview ci-dessus, sans attester un parcours distant authentifié.

Le premier commit documentaire de reprise (`016b1d3`) a utilisé l’identité Git
par défaut du nouvel environnement, associée à `@medsine`. Vercel a refusé son
déploiement car ce compte n’appartient pas à l’équipe. Le commit suivant utilise
l’identité déjà documentée dans README.md et employée par les commits de Task 10 :
`Mehdi-Sine <mehdi.sine@acta.asso.fr>`. Aucune modification d’accès ou de sécurité,
aucune réécriture de l’historique poussé. Ce refus de déploiement est distinct de
la redirection SSO protégeant la Preview applicative existante.
