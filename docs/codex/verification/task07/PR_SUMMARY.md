# Task 07 — Veille intégrée à la carte et au diagnostic

La route `/watch` expose des signaux structurés, des filtres partageables, des cartes compacte/détaillée, le détail et la provenance. Le `EvidenceBundle` versionné et la narration déterministe désactivable sont conservés, sans LLM réel ni accès libre à la DB.

Rebase sans conflit sur `main` `bde2ab2`, après Tasks 06/08. Le shell ouvre `/watch` ; les anciens `/?view=watch` redirigent. Le diagnostic Task 08 reçoit cell/production/indicator/date/rule/version exacts du signal. Le contexte carte Task 06 conserve territoire, comparaison et cadrage, aussi en démo. Le smoke Task 09 suit le parcours intégré.

Versions récentes de main préservées. Changements hors Task 07 limités à quelques lignes de raccordement dans `app/page.tsx`, `product-shell.tsx` et `tests/e2e/demo.mjs`. Aucun fichier carte/diagnostic/UI, contrat, moteur, migration, lockfile, guard ou politique de sécurité remplacé.

Validation : pnpm lint/typecheck/test/build, 106 tests web, 44 tests Python, make check complet, guards contrats/qualité/migrations/secrets/budget et smoke HTTP. Gitleaks : aucun leak. Audits Python/outils/navigateur : aucune vulnérabilité connue. Seule exception JS héritée : braces 3.0.3, GHSA-vfj7-8cjw-p6xm, limitée au dev et absente des traces de production ; aucun seuil ou exclusion ajouté.

Desktop/tablette/mobile : 25 états intégrés passent avec axe, clavier, thèmes, anciens liens et parcours Veille → Diagnostic → Carte → Veille, sans requête externe. Suites E2E shell, observation et diagnostic passent. Une différence de bbox apparue au premier lancement parallèle d’Observation ne se reproduit pas en relance isolée ; aucun code carte ni assertion modifié.

Rapport, captures et logs : `docs/codex/verification/task07/rebase/`. Vercel Preview est redéclenchée par le push ; son résultat précis sera relevé dans le suivi de cette PR. PR draft, aucun merge.

Limites conservées : source de signaux live non branchée, audit narratif non persisté en DB. Démonstration explicitement fictive et non validée scientifiquement.
