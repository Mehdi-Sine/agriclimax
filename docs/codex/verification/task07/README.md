# Task 07 — Veille / Watch

Rapport de livraison initiale, conservé comme historique. Après intégration des
Tasks 06 et 08, voir [le rapport de rebase](rebase/README.md) et ses captures.

## Base et périmètre

- Dernier main vérifié par GitHub puis `git fetch origin main` :
  `be3711e47e0272d48fb663eb1a8f205858035927`.
- Merges Tasks 01, 02, 03, 04, 05 et 09 présents dans l’ascendance.
- `make check` initial passe avant implémentation : `baseline-make-check.log`.
- Worktree : `/workspace/agriclimax-watch`, branche demandée `codex/07-watch`
  (prioritaire sur le nom historique `codex/07-watch-ai` de la task).
- Auteur configuré depuis le profil GitHub connecté :
  `Mehdi-Sine <mehdi.sine@acta.asso.fr>`.

Lecture : AGENTS racine/web, ORCHESTRATION, Task 07, PRODUCT_CHARTER,
UX_ARCHITECTURE, DESIGN_SYSTEM, BOUNDARIES, SCIENTIFIC_GOVERNANCE et règles IA
d’AGENTS. Le dépôt ne comporte pas de document de gouvernance IA séparé.

## Architecture et utilisation

Ouvrir `/watch` ou `/watch?mode=demo`. Une bannière explicite marque la fixture
comme fictive et non validée. Filtres GET production/territoire/niveau/période,
indicateur et comparaison canoniques conservés. Compacte/détaillée dans l’URL.
Le lien « Vérifier le signal » ouvre un détail partageable ; les liens carte et
diagnostic conservent le contexte du signal et la comparaison.

`StructuredResultWatchRepository` dépend uniquement de `StructuredEventSource`.
L’adapter projette un résultat contractuel ; il ne recalcule ni risque, ni
confiance, ni fraîcheur. `FixtureWatchRepository` fournit la fixture contractuelle
existante. Tous les appels reconstruisent des snapshots indépendants.
L’identifiant de signal est dérivé du contenu et de l’événement ; les doublons
sont rejetés. Les résultats invalides provoquent une erreur, sans fallback.

`WatchSignal` respecte `watch-signal.schema.json` sans champ top-level additionnel.
Son evidence ID résout un résultat complet dans `EvidenceBundle` v1.0 :
provenance, timestamps connus ou explicitement inconnus, période, territoire,
production, niveau, confiance/statut/raisons, fraîcheur, flags, règle/version,
sources et valeurs/unités. Aucun contrat ou migration modifié.

Le bundle possède un digest SHA-256 canonique, est cloné et gelé récursivement.
Son intégrité et la cohérence de ses références sont revalidées avant narration.
Ce digest détecte les modifications accidentelles ; ce n’est pas une signature
de confiance d’un producteur externe.

Les modules serveur sont protégés par `server-only`. `NarrativeProvider` ne reçoit
que le bundle fermé. `DeterministicTemplateProvider` est le seul provider livré :
aucun SDK LLM, clé, réseau ou DB dans la narration. Chaque segment renvoie à un
evidence ID ; une proposition différente de la projection factuelle autorisée
est rejetée intégralement. Aucun texte causal ou conclusion scientifique ajouté.

Le template est `watch-facts/1.0`, avec audit : payload factuel exact, bundle ID,
modèle/provider, timestamp UTC, version du template et assistance IA. Le template
déterministe est correctement affiché « sans assistance IA ». Un provider marqué
assisted est visiblement « Assisté par IA » (testé avec un faux provider).
`WATCH_NARRATIVE_ENABLED=false` désactive le service avant tout appel provider.
Une panne ou un rejet rend la narration indisponible, sans retirer les faits.
L’audit est consultable dans le détail ; il n’est pas persisté dans la DB.

## États et limites explicites

- Chargement : route `loading.tsx` ; erreur : `error.tsx` et état source-error.
- Aucun signal / signal inconnu / contexte filtré vide : missing.
- Fraîcheur stale, unknown, fresh et confiance indépendante : badges fournis.
- Niveau unavailable : affichage indisponible et information insufficient,
  sans inventer de score ou de diagnostic.
- Un niveau low n’est pas requalifié en « aucun risque » : le contrat ne fournit
  pas cette conclusion. Aucune génération d’un état processing sans événement.
- `/watch?mode=live` : adapter indisponible explicite, aucun signal fictif.
- La fixture du 2026-07-01 transporte fresh à son calcul. La validité historique
  est affichée ; fresh n’est pas assimilé à une actualité au jour de consultation.
- La connexion de la navigation shell `/?view=watch` à `/watch` est un point
  d’intégration documenté dans `cross-workstream/07-request.md`, conformément à
  ORCHESTRATION. Le shell Task 05 et ses slots existants restent inchangés.
- Carte/diagnostic métier restent les Tasks 06/08. Aucune modification scientifique,
  exposition, ingestion, DB/RLS ou fournisseur réel dans cette tâche.

## Validation

Commandes depuis la racine du worktree, pnpm 10.0.0 :

```sh
export PATH=/workspace/.agriclimax-setup/tools/node_modules/.bin:$PATH
export PYTHONPATH=engine/src
make check PYTHON=/workspace/.agriclimax-setup/venv/bin/python
python scripts/quality/security.py --bundle apps/web/.next/static
pnpm --filter @agriclimax/web exec next start --hostname 127.0.0.1
node docs/codex/verification/task07/verify-browser.mjs
git diff --check
```

Le Python préparé est utilisé car le Python initial ne contenait pas pytest.
Le PATH fixe aussi les sous-commandes pnpm, initialement résolues en version 11.
Les dépendances verrouillées ont été installées ; lockfile inchangé.

`make-check.log` contient tests qualité, contrats, 44 tests Python, lint sans
avertissement, typecheck, 52 tests web (19 nouveaux) et build Next.js de `/watch`.
`client-secret-scan.log` contrôle le bundle client. Aucun secret ajouté.

Le script navigateur utilise Chromium local et Playwright 1.62.1 installé dans
`work/browser` (hors livrables et hors dépendances du produit). Il bloque les
requêtes non locales et vérifie desktop 1440×900, tablette 1024×768, mobile 390×844 :
liste compacte/détaillée, filtre, vide, détail, contexte des liens, thème sombre,
live indisponible, overflow et axe WCAG 2.1 AA. Sur mobile : focus contenu dans
le sheet. Les résultats et captures sont stockés dans ce dossier. Axe ne constitue
pas une certification WCAG.

Résultat navigateur final : 19 états validés, zéro violation axe dans les règles
testées, zéro erreur console/page, zéro requête externe et zéro overflow horizontal.
La liste et le détail ont aussi été inspectés visuellement sur desktop et mobile.

Détection initiale : nom accessible du composant BrandLockup Task 05 masquant
une partie du texte visible. Résolu localement par composition du symbole/classes
avec nom naturel ; demande de généralisation au propriétaire du design system.

## Fichiers

- `apps/web/features/watch/` : modèle, contexte, cartes/détail, preuves,
  repositories, service narratif, tests.
- `apps/web/app/watch/` : route dédiée, styles responsive, loading/error.
- `docs/codex/cross-workstream/07-request.md` : points d’intégration.
- `docs/codex/verification/task07/` : commandes, audit, captures et résumé PR.
