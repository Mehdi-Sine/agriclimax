# Résultats — Task 08

Vérification du 11 octobre 2026. Base `be3711e` (fetch de `origin/main`
réussi), branches/merges Tasks 01–05 et 09 présents. Auteur et committer
configurés avant commit : **Mehdi-Sine <mehdi.sine@acta.asso.fr>**, identiques
au profil GitHub connecté et à l’identité de clôture Task 09.

## Contrôles exécutés

| Contrôle | Résultat / preuve |
| --- | --- |
| `make check` avant modifications | Succès ; `baseline-check.log` |
| `make check` final | Succès ; `make-check.log` |
| Tests Python moteur, ingestion, contrats | 44 réussis |
| Guards Python qualité/automation | 7 réussis |
| Guards logs Node | 2 réussis |
| Contrats/config, automation, secrets source, inventaire migrations | Réussis |
| Tests web | 74 réussis, dont 40 diagnostic et un nouveau test du lien carte live |
| ESLint / TypeScript strict | Réussis |
| Build production Next.js | Réussi, route `/diagnostic` dynamique |
| Guard bundle client | Réussi ; `bundle-security.log` |
| E2E diagnostic | Réussi ; `browser.log` et `screenshots/report.json` |
| E2E shell Task 09 | Réussi ; `shell-e2e.log` et `shell-regression/report.json` |
| `git diff --check` | Réussi |
| RPC live de lecture series | HTTP 200, zéro résultat ; `live-rpc-probe.json` |
| API series live / page diagnostic live | HTTP 200 / 200, état missing ; `live-smoke.json` |
| Navigateur live desktop/mobile | Missing, zéro badge risque/marqueur demo, aucun débordement ; `live-browser.json` |

Les tests diagnostic contrôlent l’identité complète et la version exacte,
les dates/périodes/duplicatas invalides, la série triée, les dates ambiguës,
les erreurs sans fuite ou fixture de remplacement, et la conservation des
valeurs zéro/false. Ils couvrent les cinq niveaux de risque, les cinq statuts
scientifiques, confidence indépendante, stale, insuffisant, metadata/source
absentes, échappement de texte et timestamps UTC sans normalisation silencieuse
d’une date impossible.

Le navigateur vérifie 1440×900, 1024×768 et 390×844, thèmes clair/sombre,
drawer et restauration de focus, deep-link, rechargement, historique, période
consultée, retour avec contexte territoire/comparaison, missing et live invalide.
Aucun appel distant du navigateur démo, erreur console ou débordement.
Six audits du diagnostic et quinze audits shell/catalogue : zéro violation axe
WCAG A/AA détectée. Captures pleine page et viewport dans `screenshots/` ;
captures supplémentaires missing/live et régression shell conservées.

## Environnement et corrections pendant vérification

Le proxy était initialement inaccessible en sandbox réseau ; l’accès réseau
supporté de l’exécuteur a permis fetch/install. Le pnpm global était 11 alors
que le dépôt requiert 10 : pnpm 10 local sous `work/`, caches et venv dans le
workspace, sans modification de dépendances. Les premières tentatives de
baseline avant installation/PATH correct n’étaient pas concluantes ; la preuve
conservée est le passage baseline complet réussi.

Un import devenu inutilisé a été supprimé après le premier lint. Axe a identifié
le défaut du nom accessible desktop du logo déjà décrit dans Task 09 ; un
aria-label enrichi ne résolvait pas l’écart avec le texte concaténé du contenu.
Le lien utilise finalement son texte visible comme nom accessible, et les audits
complets ont été relancés sans exclusion de règle.

La première lecture Node live, sans usage du proxy, retournait 502. La RPC via
le proxy supporté répond 200. Le serveur de vérification a été démarré avec
`NODE_USE_ENV_PROXY=1` (Node 24), sans modifier le transport Task 04 ni les
credentials ; API et page live répondent ensuite 200/missing. Aucun secret,
URL privée ou payload amont d’erreur n’a été enregistré. Aucune donnée distante
créée ou modifiée.

## Limites des preuves

Le DEV live ne contient aucun résultat pour la sélection publiée testée. Le
rendu live non vide et la série de plusieurs dates sont donc vérifiés par des
réponses de repository validées dans les tests, pas par l’insertion d’un seed
distant. Les captures live montrent la véritable collection vide.

V1 ne fournit pas seuils, définition complète/méthode de règle, nature de valeur
ni limites spécifiques : l’UI les annonce comme absents, sans compléter depuis
une fixture scientifique. Pas de série inventée pour la démo à un seul résultat.
Pas de Task 06/07/10, formule, seuil, contrat ou migration modifiés.

Les tests SQL/RLS et EXPLAIN complets Task 04 ne sont pas rejoués : aucun changement
DB/API. Les audits de vulnérabilités dépendances indépendants Task 09 ne sont
pas relancés ni déclarés verts ; leurs observations précédentes restent
consultables dans `../task09/REPORT.md`. Les dépendances sont inchangées.
Axe et tests clavier ne certifient pas la conformité WCAG complète. Aucun
déploiement ou merge ; la PR doit rester draft pour revue.
